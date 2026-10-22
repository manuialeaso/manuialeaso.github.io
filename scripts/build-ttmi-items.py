#!/usr/bin/env python3
"""Compile factual 天堂透視鏡 snapshots to executable, capability-checked game data.

No network is used. Refresh separately with fetch-ttmi-items.py and
fetch-ttmi-item-details.py. No unsupported fact is silently advertised as an effect.
"""
import collections
import json
import math
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','scripts/export-ttmi-baseline.mjs'],cwd=ROOT,check=True)
SOURCE=json.loads((ROOT/'data/ttmi-items-source.json').read_text())
DB=json.loads((ROOT/'.scratch/ttmi-baseline-db.json').read_text())
REL=json.loads((ROOT/'data/ttmi-item-relations.json').read_text()) if (ROOT/'data/ttmi-item-relations.json').exists() else {'items':[]}
REL={x['sourceId']:x for x in REL['items']}

def namekey(s):
    return re.sub(r'\s+|[()（）]|套裝','',s).replace('裡','里').replace('回覆','回復').replace('奇巖','奇岩').replace('鍊','鏈').replace('煉','鍊').replace('修練','修煉').replace('𥚃','里').replace('高侖','高崙').replace('範德','范德')

EXISTING={namekey(d['n']):k for k,d in DB['items'].items()}
SKILLS={namekey(d['n']):k for k,d in DB['skills'].items() if d.get('n')}
SPELLS={namekey(d['spellProc']['skn']):d['spellProc'] for d in DB['items'].values() if d.get('spellProc') and d['spellProc'].get('skn')}
POLYS={namekey(d['n']):d['n'] for d in DB.get('polyForms',[]) if d.get('n')}
SOURCE_BY_ID={i['sourceId']:i for i in SOURCE['items']}
SOURCE_BY_NAME={namekey(i['name']):i for i in SOURCE['items']}
CLASSES={'王族':'royal','騎士':'knight','妖精':'elf','法師':'mage','黑暗妖精':'dark','龍騎士':'dragon','幻術士':'illusion','戰士':'warrior'}
SLOTS={'belt':'belt','earring':'ear','neck':'amulet','ring':'ring','armor':'armor','boot':'boots','circlet':'helm','cloak':'cloak','glove':'gloves','greaves':'shin','guarder':'shield','helm':'helm','robe':'armor','shield':'shield','shirt':'tshirt'}
WEAPONS={'axe':'斧','claw':'鋼爪','dagger':'匕首','edoryu':'雙刀','kiringku':'奇古獸','staff':'魔杖','sword1':'單手劍','sword2':'雙手劍','spear':'矛','sword3':'鎖鏈劍','bow':'弓','knife':'飛刀'}
STAT={'力量':'str','敏捷':'dex','體質':'con','智力':'int','精神':'wis','魅力':'cha','體力上限':'mhp','魔力上限':'mmp','體力回覆量':'hpR','體力回復量':'hpR','魔力回覆量':'mpR','魔力回復量':'mpR','魔法防禦':'mr','魔攻':'mdmg','魔法攻擊力':'mdmg','魔法傷害':'mdmg','近距離命中':'meleeHit','遠距離命中':'rangedHit','近距離攻擊':'meleeDmg','遠距離攻擊':'rangedDmg','額外攻擊點數':'extraDmg','魔法命中率':'magicHit','魔力命中率':'magicHit','傷害減免':'dr','火屬性防禦':'resFire','水屬性防禦':'resWater','風屬性防禦':'resWind','地屬性防禦':'resEarth','增加負重':'weightCap','昏迷耐性':'ttmiStunResist','寒冰耐性':'ttmiFreezeResist','石化耐性':'ttmiStoneResist','睡眠耐性':'ttmiSleepResist','支撐耐性':'ttmiHoldResist','PVP 額外傷害':'ttmiPvpDmg','PVP額外攻擊點數':'ttmiPvpDmg','PVP 傷害減免':'ttmiPvpDr','PVP傷害減免':'ttmiPvpDr','PVP 額外攻擊點數':'ttmiPvpDmg','防禦':'ac','防禦力':'ac','額外防禦':'ac','藥水恢復量':'potionBonus'}
STAT.update({'攻擊力':'extraDmg','命中率':'extraHit','昏迷命中':'stunHitBonus','遠距離迴避率':'er','魔法攻擊':'mdmg','火屬性傷害':'ttmiFireDmg','水屬性傷害':'ttmiWaterDmg','風屬性傷害':'ttmiWindDmg','地屬性傷害':'ttmiEarthDmg'})
INFO=re.compile(r'^(?:不可轉移|不可刪除|不會損壞|死亡不會掉落|限制等級|商城時間|[臺台韓日陸]版價格|無界價格|效果時間：|[臺台]灣|日本|韓國|大陸|中國|活動|日版|韓版|陸版|台版|臺版|新手物品|商店|由|製作|可用於|需要材料|傳說|古代|[一二三四五六七八九十]階|只限|要與|用來製作)')

def addstat(out,label,n):
    field=STAT.get(label.strip())
    if not field:return False
    v=float(n);v=int(v) if v.is_integer() else v
    if field=='ac':v=-v
    out[field]=out.get(field,0)+v
    return True

def flatstats(line,out):
    parts=re.split('[、/，]',line)
    done=True
    for p in parts:
        p=p.strip()
        m=re.fullmatch(r'(.+?)([+\-]\d+(?:\.\d+)?)(%?)(?:\+(\d+))?',p)
        if m and m[3] and m[1] in ['體力上限','魔力上限']:
            field='ttmiMaxHpPct' if m[1]=='體力上限' else 'ttmiMaxMpPct'
            out[field]=out.get(field,0)+float(m[2])
        elif m and addstat(out,m[1],m[2]):
            if m[4] and m[1]=='藥水恢復量':out['ttmiPotionFlat']=int(m[4])
        else:done=False
    return done

def req(i):
    cls=i['classes'].split()
    return ','.join(CLASSES[x] for x in cls if x in CLASSES) or 'all'

def level_limits(d,lines):
    for line in lines:
        if not line.startswith('限制等級'):continue
        nums=[int(n) for n in re.findall(r'\d+',line)]
        if not nums:continue
        if len(nums)>=2:d['ttmiMinLevel']=nums[0];d['ttmiMaxLevel']=nums[1]
        elif '以下' in line:d['ttmiMaxLevel']=nums[0]
        else:d['ttmiMinLevel']=nums[0]

def category(i):
    cats=i['categories']
    return next((c for c in cats if c.startswith('normal')),cats[0])

def exclusion(i):
    c=' '.join(i['categories']);s=' '.join(i['facts']);n=i['name']
    if 'fishing' in c or re.search('釣竿|釣餌|釣魚袋|釣魚池.*專用',n+' '+s):return '釣魚'
    if 'k3=deco' in c:return '家具與住宅擺設'
    if 'k2=spitem' in c:return '寵物配送'
    if 'k3=light' in c:return '照明與燃料'
    if re.search(r'k3=(?:rune|tattoo|talisman|sealrune|sealrelics)(?:$| )',c):return '符石／刺青／護符獨立裝備欄'
    if re.search(r'k3=relics(?:$| )',c):return '原作輔助遺物裝備欄（不同於本作各部位遺物）'
    if 'k2=manaitem' in c:return '充能魔具'
    if re.search(r'k3=(?:tseal|tchange)',c) or any(x in s for x in ['潘朵拉的紋樣','賦予香水','工匠的支撐寶石','工匠的昏迷寶石','附魔轉換卷軸']):return '香水紋樣／專用鑲嵌'
    if 'k2=tools' in c:return '官方帳號／付費擴充服務'
    if 'k3=energy' in c:return '休息指數與道具充能'
    if any(x in s for x in ['殷海薩的祝福+','帳號內','跨伺服器','其他伺服器','伺服器轉移','擴充角色','更改角色名稱']):return '官方帳號／伺服器／休息指數'
    if 'k2=time' in c:return '限時訓練所與魂石副本'
    if any(x in s for x in ['象徵已婚','結婚戒指','飛往情人']):return '結婚'
    if any(x in s for x in ['尚無用途','尚無用處']):return '來源明列無用途'
    if any(x in s for x in ['未開放','寵物狩獵經驗值','幸運+','裝備時才會減少使用時效','刻印解除印記','使用時效的道具']):return '原作未開放、幸運、寵物經驗藥或租借時效機制'
    if '需要材料' in s and '香水' in s:return '專用香水鑲嵌'
    return None

def equipment(i):
    c=category(i);kind=c.split('&k2=')[-1].split('&')[0];sub=c.split('&k3=')[-1]
    if kind not in ['armor','acc','pet','weapon1','weapon2','weapon3']:return None,[]
    d={'n':i['name'].replace(' (套裝)','').replace('(套裝)',''),'req':req(i),'gachaWeight':0}
    mat=i['material'];a=re.search(r'安定：([\d]+|N/A)',mat)
    if a and a[1]=='N/A':d['safe']=0;d['noEnhance']=True
    else:d['safe']=int(a[1]) if a else 0
    if kind.startswith('weapon'):
        m=re.search(r'攻擊：\s*(\d+)\s*/\s*(\d+)',mat)
        if not m:return None,['來源未給武器傷害']
        d.update(type='wpn',dmgS=int(m[1]),dmgL=int(m[2]),hit=0,spd=1)
        d['ttmiTags']=[WEAPONS[sub]]
        if '雙手' in mat:d['w2h']=True
        if sub=='bow':
            if i['name'].endswith('箭') and '弓' not in i['name']:d.update(isArrow=True,noEnhance=True);d['ttmiTags']=[]
            else:d.update(isBow=True,ranged=True,rapidfire=20)
        if sub=='axe':d['ttmiTags']=['雙手鈍器' if '雙手' in mat else '單手鈍器'];d['eff']='crush' if '雙手' in mat else 'blunt'
        if sub=='claw':d.update(eff='combo',comboRate=20)
        if sub=='edoryu':d.update(eff='combo',comboRate=20)
        if sub=='sword2':d.update(eff='cleave')
        if sub=='kiringku':d.update(qigu=True,eff='magicstrike')
        if sub=='staff':d.update(isWand=True,eff='magicstrike')
        if sub=='sword3':d.update(chainsword=True,weakExpose=True,eff='combo',comboRate=20)
        if sub=='knife':d.update(ranged=True,isThrowing=True)
    else:
        if kind=='pet':d.update(type='arm',slot='petwpn' if sub=='weapon' else 'petarm')
        elif sub not in SLOTS:return None,['本作沒有對應裝備欄']
        else:d.update(type='acc' if kind=='acc' else 'arm',slot=SLOTS[sub])
        a=re.search(r'防禦：\s*([+\-]?\d+)',mat)
        d['ac']=-int(a[1]) if a else 0
        if sub=='guarder':d.update(armguard=True)
    if '重量：' in mat:
        a=re.search(r'重量：([\d.]+)',mat)
        if a:d['ttmiWeight']=float(a[1])
    unhandled=[];conditional=[];powers=[];facts=[]
    for line in i['facts']:
        if flatstats(line,{}):
            x={};flatstats(line,x)
            if d['type']=='wpn':
                if 'extraDmg'in x:x['dmgBonus']=x.pop('extraDmg')
                if 'meleeHit'in x:x['hit']=x.pop('meleeHit')
                if 'rangedHit'in x:x['hit']=x.pop('rangedHit')
            for k,v in x.items():d[k]=d.get(k,0)+v
            facts.append(line);continue
        m=re.match(r'^【\+(\d+)(?:~\+(\d+))?】(.+)$',line)
        if m:
            x={}
            if flatstats(m[3],x):conditional.append({'minEn':int(m[1]),'maxEn':int(m[2]) if m[2] else 99,'stats':x});facts.append(line);continue
            unhandled.append(line);continue
        m=re.match(r'^【('+'|'.join(CLASSES)+r')】(.+)$',line)
        if m:
            x={}
            if flatstats(m[2],x):conditional.append({'cls':CLASSES[m[1]],'stats':x});facts.append(line);continue
            unhandled.append(line);continue
        if line=='不死系加成':d['unBonus']=True;facts.append('對不死系追加傷害。');continue
        if line=='貫穿效果':d['ignHardSkin']=True;facts.append('攻擊無視硬皮。');continue
        if line=='防護中毒狀態':d['immPoison']=True;facts.append('免疫中毒。');continue
        if line=='吸取魔力':d.update(mpOnHit=True,mpOnHitAmt=3,ttmiAdaptation='來源未列吸魔量；採本作同類武器每次命中 3 MP');facts.append('命中恢復 3 MP。');continue
        m=re.fullmatch(r'吸取魔力(\d+)點',line)
        if m:d.update(mpOnHit=True,mpOnHitAmt=int(m[1]));facts.append(line);continue
        if line=='吸取體力':d.update(vampPct=0.05,ttmiAdaptation='來源未列吸血量；採本作同類武器傷害量 5%');facts.append('普通攻擊恢復傷害量 5% 的 HP。');continue
        m=re.fullmatch(r'使用[武防]捲成功\+1，(PVP額外攻擊點數|PVP傷害減免)也會\+(\d+)',line)
        if m:d['ttmiPvpDmgPerEn' if '攻擊' in m[1] else 'ttmiPvpDrPerEn']=int(m[2]);facts.append(line);continue
        if '使用防捲成功+1，魔法防禦也會+' in line:
            d['mrPerEn']=int(re.search(r'也會\+(\d+)',line)[1]);facts.append(line);continue
        if re.search(r'使用武捲成功\+1，魔法發動機率也會\+1%',line):d['procRatePerEn']=1;continue
        if '進行強化必須使用「象牙塔對' in line or re.search(r'需要使用「屍魂對[武盔].+才能進行強化',line):
            # Same weapon/armor strengthening system; dedicated scroll aliases are registered.
            d['ttmiEnhanceScroll']='ivory' if '象牙塔' in line else 'soul';d['ttmiAdaptation']='沿用本作同部位強化卷軸與成功率';continue
        if '依照職業不同' in line:continue
        if re.fullmatch(r'人物速度 x[\d.]+\(1段加速\)',line):d['equipHaste']=True;facts.append('裝備時獲得一段加速。');continue
        if '限制等級' in line:
            level_limits(d,[line]);facts.append(line);continue
        m=re.fullmatch(r'(\d+)%機率施展「([^」]+)」',line)
        if m:
            name=namekey(m[2]);rate=int(m[1]);skill=SKILLS.get(name);spell=SPELLS.get(name)
            if m[2]=='弱點曝光':d['weakExpose']=True;facts.append(line);continue
            if spell:d.update(spellProc=spell,procRateBase=rate);facts.append(line);continue
            if skill:
                sk=DB['skills'][skill]
                if sk.get('status') and not sk.get('dmgDice'):d['procStatusSkill']={'skId':skill,'rate':rate}
                else:d.update(procSkill=skill,procRateBase=rate)
                facts.append(line);continue
            unhandled.append(line);continue
        m=re.fullmatch(r'被攻擊時有(\d+)%機率施展「反擊敵人(\d+)點傷害」',line)
        if m:d['ttmiReflect']={'rate':int(m[1]),'dmg':int(m[2])};facts.append(line);continue
        m=re.fullmatch(r'狩獵經驗值 x([\d.]+)',line)
        if m:d['ttmiExpMult']=float(m[1]);facts.append(line);continue
        if INFO.match(line) or line in ['聖屬性','攻擊力是看智力而非力量。'] or any(z in line for z in ['套裝','套裝似乎','好友度等級','法師滿','任務獎勵','活動的獎品','可以賣給','已經無法','商店售價','蒐集暴走的變異','跟回憶的','如果有冰之結晶']):continue
        if not line:continue
        unhandled.append(line)
    if kind=='pet':
        # Pet gear is read by petDerive/petGearBonus, never by character stats.
        pet_fields={'ac':'petAc','int':'petInt','wis':'petWis','mr':'petMr','mdmg':'petMdmg','meleeHit':'petHit','extraHit':'petHit','extraDmg':'petDmg','ttmiExpMult':'ttmiPetExpMult'}
        for field,target in pet_fields.items():
            if field in d:d[target]=d.get(target,0)+d.pop(field)
        for field in ['str','dex','con','cha']:
            if d.get(field):unhandled.append('本作寵物沒有對應的基礎屬性：'+field)
        if conditional:unhandled.append('寵物強化條件尚無對應統計流程')
    if d.get('isArrow'):
        for ele in ['Fire','Water','Wind','Earth']:
            field='ttmi'+ele+'Dmg'
            if d.get(field):d['onHitEleDmg']={'ele':ele.lower(),'dmg':d.pop(field),'rate':100}
    if conditional:d['ttmiConditional']=conditional
    if unhandled:return None,unhandled
    score=10+d.get('dmgS',0)+d.get('dmgL',0)+abs(d.get('ac',0))*5
    score+=sum(abs(d.get(k,0)) for k in ['str','dex','con','int','wis','cha','dr','mdmg','petInt','petWis','petMdmg','ttmiPvpDmg','ttmiPvpDr'])*10
    score+=sum(abs(d.get(k,0)) for k in ['hit','extraHit','dmgBonus','extraDmg','meleeHit','rangedHit','meleeDmg','rangedDmg','petHit','petDmg','petAc'])*5
    score+=(abs(d.get('mhp',0))/20+abs(d.get('mmp',0))/10+abs(d.get('mr',0))/5+abs(d.get('petMr',0))/5)
    score+=max(0,d.get('ttmiPetExpMult',1)-1)*100
    d['p']=max(1000,int(score**2*25))
    if d.get('isArrow'):d['p']=max(1,d['dmgS']+d['dmgL'])
    d['d']='鍛火與歲月留下的戰鬥裝備。'+(' '.join(facts) if facts else '')
    return d,[]

def duration(facts):
    for line in facts:
        if not line.startswith('效果時間：'):continue
        m=re.search(r'(\d+)\s*(秒|分鐘|分鐘|分|小時|天)',line)
        if m:return int(m[1])*{'秒':1,'分':60,'分鐘':60,'小時':3600,'天':86400}[m[2]]
    return None

def info(line):
    return bool(INFO.match(line) or re.search(r'活動.*(?:道具|獎品|贈品)|活動「|有販售|商店.*販售|^數量：|^角色登出|^飽食|^增加飽食|料理.*材料|^不可|^無法轉移|^每次召喚消耗',line))

def potion(i):
    n=i['name'];c=category(i);lines=i['facts'];dur=duration(lines)
    # Buff scrolls/coins use the same factual consumable mechanism; the archive
    # does not consistently file them under the potion category.
    if not any(k in c for k in ['food','potion','eve00','eve01']) and not dur:return None,[]
    d={'n':n,'type':'pot','req':req(i),'gachaWeight':0,'p':100};stats={};unknown=[];hp=False;mp=False;haste=[];acts=[]
    for line in lines:
        if info(line) or not line:continue
        text=line.replace('回覆','恢復').replace('回復','恢復')
        text=re.sub(r'^(體力|魔力)恢復',r'恢復\1',text)
        m=re.fullmatch(r'藥水延遲：([\d.]+)秒',text)
        if m:d['ttmiPotionCooldown']=float(m[1]);continue
        m=re.fullmatch(r'恢復\s*(\d+)\s*[~～\-]\s*(\d+)\s*(?:點)?(體力|魔力)',text)
        if not m:
            mm=re.fullmatch(r'恢復(體力|魔力)(?:量)?\s*(\d+)\s*[~～\-]\s*(\d+)',text)
            if mm:m=(None,mm[2],mm[3],mm[1])
        if m:
            if m[3]=='體力':d.update(valMin=int(m[1]),valMax=int(m[2]),ttmiHealPotion=True);hp=True
            else:d.update(ttmiMpMin=int(m[1]),ttmiMpMax=int(m[2]));mp=True
            continue
        m=re.fullmatch(r'恢復(?:\s*)(\d+)(?:點)?(體力|魔力)',text)
        if not m:
            mm=re.fullmatch(r'恢復(體力|魔力)(?:量)?\s*(\d+)(?:點)?',text)
            if mm:m=(None,mm[2],mm[1])
        if m:
            if m[2]=='體力':d.update(val=int(m[1]),ttmiHealPotion=True);hp=True
            else:d.update(ttmiMpMin=int(m[1]),ttmiMpMax=int(m[1]));mp=True
            continue
        m=re.fullmatch(r'人物(?:移動)?速度 x([\d.]+)\(([123])段加速\)',text)
        if m:
            if not dur:unknown.append('加速效果未列時效');continue
            haste.append({'stage':int(m[2]),'mult':float(m[1]),'moveOnly':'移動' in text});continue
        if flatstats(line,{}):flatstats(line,stats);continue
        m=re.fullmatch(r'狩獵經驗值 x([\d.]+)',line)
        if m:stats['ttmiExpMult']=float(m[1]);continue
        if text.startswith('精神11以下，魔力恢復量+1'):
            d['ttmiBlueBase']=10;acts.append('blue');continue
        m=re.fullmatch(r'精神12以上，魔力恢復量\+\(精神-(\d+)\)[。.]?',text)
        if m:d['ttmiBlueBase']=int(m[1]);acts.append('blue');continue
        if '解除身上的毒素' in text or text in ['解毒','解除中毒狀態']:acts.append('antidote');continue
        if text.startswith('變身：'):
            form=text.split('：',1)[1].strip();mapped=POLYS.get(namekey(form))
            if mapped:d['ttmiPolyForm']=mapped;acts.append('poly')
            else:unknown.append('變身型態尚無速度資料：'+form)
            continue
        if text in ['改變自身型體成為其他生物的模樣','將使用者變身成其他怪物的樣子']:acts.append('poly');continue
        if '料理' in text or '飽食' in text:continue
        unknown.append(line)
    if unknown:return None,unknown
    if stats:
        if not dur:return None,['屬性增益未列持續時間']
        d.update(ttmiBuff=stats,ttmiBuffFamily='food' if 'food' in c and not 'potion' in c else ('exp' if set(stats)=={'ttmiExpMult'} else 'combat'))
    if haste:d['ttmiHaste']=haste
    if dur:d['dur']=dur
    if hp:d['ttmiPotionCooldown']=d.get('ttmiPotionCooldown',1);d['p']=max(20,d.get('valMax',d.get('val',20))*3)
    elif mp:d['ttmiAction']='mp';d['ttmiPotionCooldown']=d.get('ttmiPotionCooldown',1);d['p']=max(30,d['ttmiMpMax']*5)
    elif acts:d['ttmiAction']=acts[0]
    elif stats or haste:d['ttmiAction']='buff'
    else:return None,[]
    if acts:d['ttmiExtraActions']=sorted(set(acts))
    words=[]
    if hp:words.append('恢復 '+(str(d['val']) if 'val'in d else str(d['valMin'])+'～'+str(d['valMax']))+' HP')
    if mp:words.append('恢復 '+str(d['ttmiMpMin'])+'～'+str(d['ttmiMpMax'])+' MP')
    if stats:words.append('獲得'+describe_stats(stats))
    for h in haste:words.append(str(h['stage'])+'段'+('移動' if h['moveOnly'] else '')+'加速 ×'+str(h['mult']))
    if 'blue'in acts:words.append('MP 自然恢復提高：精神未滿 12 時 +1，否則增加精神－'+str(d['ttmiBlueBase']))
    if 'antidote'in acts:words.append('解除中毒與猛毒')
    if 'poly'in acts:words.append('變身為'+d.get('ttmiPolyForm','目前等級可用的型態'))
    if dur:words.append('持續 '+str(dur)+' 秒')
    if d.get('ttmiPotionCooldown'):words.append('藥水冷卻 '+str(d['ttmiPotionCooldown'])+' 秒')
    if stats:words.append('同類增益僅保留最後使用的一種')
    d['d']='；'.join(words)+'。'
    return d,[]

def describe_stats(stats):
    labels={v:k for k,v in STAT.items()};labels.update({'mhp':'HP 上限','mmp':'MP 上限','hpR':'HP 自然恢復','mpR':'MP 自然恢復','mdmg':'魔法傷害','ttmiExpMult':'狩獵經驗倍率','ttmiMaxHpPct':'HP 上限','ttmiMaxMpPct':'MP 上限'})
    return '、'.join((labels.get(k,k)+(' ×'+str(v) if k=='ttmiExpMult' else ('+' if (-v if k=='ac' else v)>=0 else '')+str(-v if k=='ac' else v)+('%' if k in ['ttmiMaxHpPct','ttmiMaxMpPct'] else ''))) for k,v in stats.items())


def doll(i):
    if not any('k3=mgtoy' in c for c in i['categories']):return None,[]
    if not ('魔法娃娃' in i['name']):return None,[]
    d={'n':i['name'],'type':'acc','slot':'doll','doll':True,'dollTier':1,'req':'all','safe':0,'noEnhance':True,'gachaWeight':0,'p':100000};unknown=[];facts=[]
    for line in i['facts']:
        if info(line) or not line:continue
        if flatstats(line,{}):flatstats(line,d);facts.append(line);continue
        m=re.fullmatch(r'(\d+)%機率，攻擊力\+(\d+)',line)
        if m:d['procBonusDmg']={'rate':int(m[1]),'dmg':int(m[2])};facts.append(line);continue
        m=re.fullmatch(r'(\d+)%機率，傷害減免\+(\d+)',line)
        if m:d['procDmgReduce']={'rate':int(m[1]),'amount':int(m[2])};facts.append(line);continue
        m=re.fullmatch(r'每(\d+)秒，(體力|魔力)恢復(\d+)',line)
        if m:d.setdefault('ttmiPeriodic',[]).append({'sec':int(m[1]),'stat':'hp' if m[2]=='體力' else 'mp','amount':int(m[3])});facts.append(line);continue
        m=re.fullmatch(r'狩獵經驗值 x([\d.]+)',line)
        if m:d['expBonus']=round((float(m[1])-1)*100,5);facts.append(line);continue
        unknown.append(line)
    if unknown:return None,unknown
    if not facts:return None,['來源未列可用的魔法娃娃能力']
    d['d']='寄宿微光的魔法娃娃。裝入魔法娃娃欄後生效。'+'；'.join(facts)+'。'
    d['ttmiAdaptation']='沿用本作永久娃娃裝備，不另增召喚時效與結晶維持費'
    return d,[]

def utility(i):
    n=i['name'];c=category(i);txt=' '.join(i['facts']);dur=duration(i['facts'])
    d={'n':n,'type':'etc','req':req(i),'gachaWeight':0,'p':1000}
    if 'k3=scroll3' in c and '魔法卷軸' in n:
        inside=re.search(r'[（(]([^()（）]+)[)）]',n)
        sk=SKILLS.get(namekey(inside[1])) if inside else None
        if sk:
            if DB['skills'][sk]['type']=='manual':
                if DB['skills'][sk].get('mEff')=='teleport':d.update(type='scroll',eff='teleport_scroll',d='展開卷軸，將自己傳送離開目前的敵群。');return d,[]
                return None,['卷軸所記魔法需要本作未支援的手動目標流程']
            d.update(ttmiAction='scroll',ttmiSkill=sk,d='展開卷軸施放「'+DB['skills'][sk]['n']+'」，無須學習，不消耗 MP；沿用該法術的目標、狀態與冷卻規則。')
            if dur:d['dur']=dur
            return d,[]
        if n.startswith('空的魔法卷軸'):
            d.update(noUse=True,ttmiMaterial=True,d='刻寫法術卷軸的底材，可交給材料工坊製作。');return d,[]
        return None,['本作技能表沒有對應法術']
    if 'k3=scroll2' in c:
        target=None
        if txt=='能增加武器的攻擊力':target='scroll_weapon'
        if txt=='能增加防具的防禦力':target='scroll_armor'
        if '用來強化腰帶、項鍊、戒指、耳環' in txt:target='scroll_acc'
        if '解除身上道具的詛咒' in txt:target='new_item_uncurse'
        if target:
            d.update(ttmiAction='exchange',ttmiResult=target,p=DB['items'][target].get('p',1000),d='展開後取得一張「'+DB['items'][target]['n']+'」，使用方式與強化規則相同。',ttmiAdaptation='專用卷軸轉入本作既有強化／解咒流程')
            return d,[]
    if 'k3=scroll1' in c:
        if '隨機傳送' in txt:d.update(type='scroll',eff='teleport_scroll',d='將使用者傳送離開目前的敵群；遵守所在區域的傳送限制。');return d,[]
        if '傳送至附近的村莊' in txt:d.update(ttmiAction='returnTown',d='展開歸途的咒文，返回最近停留的村莊；受控與裂痕內無法使用。');return d,[]
        return None,['傳送目的地／符印通行規則未對應本作路線']
    if 'k3=scroll4' in c or ('變形' in n and dur):
        forms=[line.split('：',1)[1].strip() for line in i['facts'] if line.startswith('變身：')]
        if forms:
            mapped=POLYS.get(namekey(forms[0]))
            if mapped and dur:d.update(ttmiAction='poly',ttmiPolyForm=mapped,dur=dur,d='變身為'+mapped+'，持續 '+str(dur)+' 秒；須達到該型態的開放等級。');return d,[]
            return None,['變身型態尚無速度資料：'+forms[0]]
        if dur and any(x in txt for x in ['改變自身','可以變身','變身為','隨機變','變形控制']):
            d.update(type='scroll',eff='poly',dur=dur,d='變身為目前等級可用的型態，持續 '+str(dur)+' 秒。');return d,[]
        return None,['來源未列可核對的變身型態或時效']
    if 'k3=scroll5' in c:
        m=re.search(r'領取經驗值(\d+)',txt)
        if m:d.update(eff='expsoul',expGain=int(m[1]),p=max(10000,int(m[1])*2),d='使用後獲得 '+f'{int(m[1]):,}'+' 經驗值。');return d,[]
        return None,['死亡經驗憑證未對應本作經典模式買回紀錄']
    return None,[]


def arena(i):
    sid=i['sourceId'];base={'n':i['name'].replace('(角鬥戰場)','（裂痕專用）'),'type':'pot','req':'all','gachaWeight':0,'p':0,'ttmiRiftOnly':True,'noTrade':True}
    custom={12029:{'ttmiHealPotion':True,'valMin':10,'valMax':20,'ttmiPotionCooldown':1.03,'ttmiCost':1,'d':'裂痕中的急救藥水。恢復 10～20 HP，冷卻 1.03 秒。'},12030:{'ttmiHealPotion':True,'valMin':60,'valMax':80,'ttmiPotionCooldown':0.53,'ttmiCost':5,'d':'凝縮裂痕之力的急救藥水。恢復 60～80 HP，冷卻 0.53 秒。'},12031:{'eff':'haste','dur':1800,'ttmiCost':5,'d':'獲得一段加速，持續 1,800 秒。'},12032:{'eff':'brave','dur':600,'ttmiCost':5,'d':'獲得二段加速，持續 600 秒。'},12033:{'ttmiAction':'thirdHaste','dur':600,'ttmiCost':5,'d':'攻擊、移動與施法速度提高 15%，持續 600 秒。'},12034:{'ttmiAction':'blue','dur':1800,'ttmiCost':3,'d':'提高 MP 自然恢復：精神未滿 12 時 +1；精神達 12 時增加「精神－8」。持續 1,800 秒。'},12035:{'ttmiAction':'mp','valMin':8,'valMax':17,'ttmiPotionCooldown':1,'ttmiCost':2,'d':'恢復 8～17 MP，冷卻 1 秒。'},12036:{'eff':'poly','dur':1800,'ttmiCost':3,'d':'變身為目前等級可用的型態，持續 1,800 秒。'},12037:{'eff':'poly','dur':1800,'ttmiCost':6,'ttmiControlledPoly':True,'d':'選擇目前等級可用的變身型態，持續 1,800 秒。'},12038:{'ttmiAction':'antidote','ttmiCost':1,'d':'解除中毒與猛毒。'},12039:{'n':'裂痕戰勳','type':'etc','noUse':True,'d':'擊敗裂痕中的敵人取得，可換取本場戰鬥的專用補給。'}}
    if sid not in custom:return None
    base.update(custom[sid]);base['d']+=' 僅限時空裂痕內使用，離場後消失。'
    if sid in [12029,12030,12035]:base['ttmiAdaptation']='來源未列補量，採專案同類消耗品基準'
    return base

def compile_all():
    rows=[];coverage=[];candidates={};records={}
    for i in SOURCE['items']:
        sid=i['sourceId'];key=namekey(i['name']);existing='gold' if sid==69 else EXISTING.get(key)
        record={'sourceId':sid,'name':i['name'],'source':i['source'],'category':category(i)};records[sid]=record;coverage.append(record)
        # The archived UI renamed old 11/21/.../91F tokens to 2/3/.../10F;
        # their factual destination still says 11/21/.../91F. Keep the project's
        # already functioning keys rather than adding duplicate inert tokens.
        if not existing and re.match(r'^(?:封印的)?傲慢之塔(?:移動卷軸|傳送符|\d+樓傳送符)',i['name']):
            dest=re.search(r'傲慢之塔(\d+)樓',' '.join(i['facts']))
            kind='scroll' if '移動卷軸' in i['name'] else 'sealed' if '封印' in i['name'] else 'pass'
            floor=int(dest[1]) if dest else None
            if floor is None and kind=='sealed':
                num=re.search(r'傲慢之塔(\d+)樓',i['name'])
                if num and 2<=int(num[1])<=10:floor=(int(num[1])-1)*10+1
            candidate='item_pride_'+kind+'_'+str(floor)
            if candidate in DB['items']:existing=candidate;record['matchReason']='以來源記載目的地對齊本作舊塔樓層／符印'
        if existing:
            record.update(status='existing',id=existing)
            candidates[sid]={'sourceId':sid,'n':i['name'],'existingId':existing,'source':i['source'],'relation':REL.get(sid,{})};continue
        ex=exclusion(i)
        if ex:record.update(status='excluded-system',reason=ex);continue
        c=category(i);d=None;unhandled=[]
        if 'k2=athena' in c:d=arena(i)
        elif c.startswith(('normal','event')):d,unhandled=equipment(i)
        else:
            d,unhandled=utility(i)
            if d is None and not unhandled:d,unhandled=doll(i)
            if d is None and not unhandled:d,unhandled=potion(i)
            if d is None and ('k2=material' in c or 'k3=metal' in c or 'k2=yamato&k3=met' in c or '料理的食材' in ' '.join(i['facts'])):
                d={'n':i['name'],'type':'etc','noUse':True,'gachaWeight':0,'p':100,'ttmiMaterial':True,'d':'鍛造、合成或調製的材料。可在材料工坊查看製作用途。'}
                unhandled=[]
            if d is None and 'k2=spellbook' in c:
                inside=re.search(r'[（(](.+)[)）]',i['name']);sk=SKILLS.get(namekey(inside[1])) if inside else None
                if sk:d={'n':i['name'],'type':'skillbk','sk':sk,'req':req(i),'gachaWeight':0,'p':10000,'d':'記錄著'+DB['skills'][sk]['n']+'的奧祕；符合職業與等級條件即可學習。'};unhandled=[]
                else:unhandled=['本作技能表沒有對應的可學習技能']
            # A small set of packages states exact rewards directly in its
            # factual text rather than in the exchange table.
            if not REL.get(sid,{}).get('contents'):
                for line in i['facts']:
                    hit=re.fullmatch(r'開啟獲得「([^」]+)」(\d+)個',line)
                    reverse=re.fullmatch(r'開啟獲得(\d+)個「([^」]+)」',line)
                    name=hit[1] if hit else reverse[2] if reverse else None
                    qty=int(hit[2] if hit else reverse[1]) if name else 0
                    reward=SOURCE_BY_NAME.get(namekey(name)) if name else None
                    if reward and qty>0:
                        REL.setdefault(sid,{'sourceId':sid})['contents']=[{'sourceId':reward['sourceId'],'min':qty,'max':qty}]
                        REL[sid]['contentsMode']='all'
            if d is None and REL.get(sid,{}).get('contents'):
                d={'n':i['name'],'type':'etc','ttmiAction':'box','req':'all','gachaWeight':0,'p':1000,'d':'封存著遠行者留下的補給，開啟後可取得其中的物品。'};unhandled=[]
                if '22小時' in ' '.join(i['facts']):d['ttmiBoxCooldown']=22*3600
        if d is None:
            if unhandled:record.update(status='blocked-fact',reason='；'.join(unhandled))
            elif any(z in c for z in ['box','bag']):record.update(status='blocked-fact',reason='來源沒有可核對的開箱內容或數量')
            elif any(z in c for z in ['quest','holiday','coin','key','canuse','other']):record.update(status='excluded-system',reason='專屬任務／活動兌換／封印鑰匙流程尚未存在')
            else:record.update(status='blocked-fact',reason='來源效果尚未對應可執行機制')
            continue
        if d.get('ttmiAction'):
            # Existing inventory UI exposes usable misc objects via eff. This
            # also makes a disabled plug-in a harmless no-op, not a generic
            # potion that consumes itself while setting an undefined buff.
            d['type']='misc';d['eff']='ttmi_item'
        level_limits(d,i['facts'])
        row={'sourceId':sid,'n':i['name'],'id':('potion_heal_ttmi_' if d.get('ttmiHealPotion') else 'ttmi_')+str(sid),'def':d,'source':i['source'],'relation':REL.get(sid,{})}
        if d.get('type') in ['wpn','arm','acc'] and any(x.startswith('效果時間：') for x in i['facts']):d.setdefault('ttmiAdaptation','沿用本作永久裝備保存，不新增官方活動回收排程')
        candidates[sid]=row;record.update(status='added',id=row['id'])
    # Ingredients used by a supported result can live in the existing crafting system.
    # Quest-only tokens with no such link stay excluded; strict system exclusions win.
    changed=True
    while changed:
        changed=False
        for i in SOURCE['items']:
            sid=i['sourceId']
            if sid in candidates or exclusion(i):continue
            rel=REL.get(sid,{})
            if not any(x['sourceId'] in candidates for x in rel.get('usedBy',[])):continue
            if not any('材料' in x or '製作' in x for x in i['facts']):continue
            if category(i).startswith(('normal','event')):continue
            d={'n':i['name'],'type':'etc','noUse':True,'gachaWeight':0,'p':100,'ttmiMaterial':True,'d':'工坊所需的合成材料。'}
            candidates[sid]={'sourceId':sid,'n':i['name'],'id':'ttmi_'+str(sid),'def':d,'source':i['source'],'relation':rel}
            records[sid].update(status='added',id='ttmi_'+str(sid));records[sid].pop('reason',None);changed=True
    # Boxes retain only supported rewards. Weighting was not published by TTMI;
    # random tables explicitly adopt equal chances in this game's adaptation.
    changed=True
    while changed:
        changed=False
        for sid,row in list(candidates.items()):
            d=row.get('def',{})
            if d.get('ttmiAction')!='box':continue
            raw=row['relation'].get('contents',[])
            contents=[x for x in raw if x['sourceId'] in candidates and x['sourceId']!=sid and x.get('min',0)>0 and x.get('max',0)>=x.get('min',0) and not candidates[x['sourceId']].get('def',{}).get('ttmiRiftOnly')]
            if not contents:
                del candidates[sid];records[sid].update(status='excluded-system',reason='開箱表僅含本作不存在系統的物品或自指獎勵');records[sid].pop('id',None);changed=True
            else:
                row['contents']=[{'sourceId':x['sourceId'],'min':x['min'],'max':x['max']} for x in contents]
                row['contentsMode']=row['relation'].get('contentsMode','random')
                row['omittedContents']=[x['sourceId'] for x in raw if x not in contents]
                d['ttmiAdaptation']='只保留本作相容獎勵；隨機表未公告權重，採等機率'
                d['d']=('每隔 22 小時可開啟一次。' if d.get('ttmiBoxCooldown') else '')+('隨機取得下列一種：' if row['contentsMode']=='random' else '開啟取得：')+'、'.join(candidates[x['sourceId']]['n']+' ×'+(str(x['min']) if x['min']==x['max'] else str(x['min'])+'～'+str(x['max'])) for x in contents[:6])+('等 '+str(len(contents))+' 種獎勵。' if len(contents)>6 else '。')
    # Recipes remain separate alternatives and preserve source yield/counts.
    for sid,row in list(candidates.items()):
        d=row.get('def',{});rel=row['relation'];recipes=[]
        for variant in rel.get('recipes',[{'parts':rel.get('recipe',[]),'yield':1}]):
            parts=variant['parts'];out=[]
            for part in parts:
                q=candidates.get(part['sourceId'])
                if q and part['sourceId']!=sid and part['count']>0 and part['count']==int(part['count']):out.append({'sourceId':part['sourceId'],'count':int(part['count'])})
            if out and len(out)==len(parts):recipes.append({'parts':out,'yield':variant.get('yield',1)})
        if recipes:row['recipes']=recipes
        if 'def' not in row:continue
        if d.get('ttmiMaterial'):
            targets=[x['sourceId'] for x in rel.get('usedBy',[]) if x['sourceId'] in candidates and x['sourceId']!=sid]
            if targets:row['usedBy']=targets
            # The workshop has a conservative, explicit sink for otherwise
            # unlinked raw materials; it is a project recipe, not a TTMI claim.
            if sid!=7102:row['refine']=True
            if not targets:d['d']='可交給材料工坊：每 10 份材料與 100 金幣，提煉為 1 個魔法結晶體。'
            if sid==14889:d['d']='喚回失落生命的葉片。於材料工坊搭配失去氣息的道具，復原其原有力量。';d['p']=100000
            if re.match(r'^失去(?:氣息|力量)的',d['n']):
                target=SOURCE_BY_NAME.get(namekey(re.sub(r'^失去(?:氣息|力量)的\s*','',d['n'])))
                if target and target['sourceId']!=sid and target['sourceId'] in candidates:
                    row['restore']={'result':target['sourceId'],'leaf':14889}
                    d['d']='在材料工坊以本物品與生命之葉各 1 份，復原為'+target['name']+'；另需 1,000 金幣。'
                    d['ttmiAdaptation']='沿用本作確定產出的製作流程；來源未公告復原機率'
                    td=candidates[target['sourceId']].get('def') or DB['items'].get(candidates[target['sourceId']].get('existingId'),{})
                    d['p']=max(10000,int(td.get('p',10000)*0.25))
        rows.append(row)
    aliases=[dict({'sourceId':sid,'name':x['n'],'id':x['existingId']},**({'recipes':x['recipes']} if x.get('recipes') else {})) for sid,x in candidates.items() if 'existingId'in x]
    # Ship only relationships used by the runtime; raw evidence stays in data/.
    for row in rows:row['dropMobs']=row.pop('relation').get('dropMobs',[])
    payload={'schema':1,'source':'天堂透視鏡','retrievedAt':SOURCE['retrievedAt'],'sourcePages':len(SOURCE['pages']),'sourceItems':len(SOURCE['items']),'aliases':aliases,'items':rows}
    (ROOT/'afk-ttmi-items-data.js').write_text('/* Generated: python3 scripts/build-ttmi-items.py. Factual item definitions; no network at runtime. */\nwindow.__AFK_TTMI_ITEMS = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
    counts=collections.Counter(x['status'] for x in coverage)
    report={'counts':dict(counts),'sourcePages':len(SOURCE['pages']),'sourceItems':len(SOURCE['items']),'sourceFailures':SOURCE['failures'],'relationRows':len(REL),'items':coverage}
    (ROOT/'data/ttmi-items-coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'counts':dict(counts),'added':len(rows),'aliases':len(aliases),'recipes':sum(len(x.get('recipes',[])) for x in rows),'boxes':sum(bool(x.get('contents')) for x in rows),'materials':sum(x['def'].get('ttmiMaterial',False) for x in rows)},ensure_ascii=False))

if __name__=='__main__':compile_all()
