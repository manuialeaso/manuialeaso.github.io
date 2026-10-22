#!/usr/bin/env python3
"""Refresh factual recipe/drop relationships for usable item categories."""
import concurrent.futures
import importlib.util
import json
import re
import sys
from pathlib import Path
from lxml import html

SPEC=importlib.util.spec_from_file_location('ttmi',Path(__file__).with_name('fetch-ttmi-items.py'))
M=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(M)

def ident(a):
    m=re.search(r'&item=(\d+)',a.get('href',''))
    return int(m.group(1)) if m else None

def get(item):
    path='index.php-view=item&item='+str(item['sourceId'])+'.htm'
    _,url,data=M.fetch(path);page=html.fromstring(data.decode('utf-8',errors='replace'))
    result={'sourceId':item['sourceId'],'source':url,'dropMobs':[], 'recipe':[], 'usedBy':[], 'contents':[]}
    # Only public item tables; ignore comments, scripts, user price reports.
    result['dropMobs']=sorted(set(M.text(a) for a in page.xpath('//a[contains(@href,"view=npc&npc=")]') if M.text(a)))
    result['recipes']=[]
    for form in page.xpath('//form[@id="form2"]'):
        parts=[]
        for el in form.xpath('.//strong[@id="material_num"]'):
            if any('hidden' in y.get('class','').split() for y in el.iterancestors()):continue
            cell=el.getparent();a=cell.xpath('.//a[contains(@href,"item=")]')
            num=re.sub(r'[^\d.]','',M.text(el))
            if a and ident(a[0]) and num:
                parts.append({'sourceId':ident(a[0]),'name':M.text(a[0]),'count':float(num)})
        if parts:
            qty=re.search(r'成品：.*?x\s*(\d+)',M.text(form))
            result['recipes'].append({'parts':parts,'yield':int(qty[1]) if qty else 1})
    if result['recipes']:result['recipe']=result['recipes'][0]['parts']
    for tab in page.xpath('//table'):
        rows=tab.xpath('./tr|./tbody/tr')
        if not rows:
            continue
        first=M.text(rows[0])
        if first=='所需物品 產生物品':
            # Opening/exchange tables have nested tables. Select only an input
            # consisting of this container itself, never a different recipe.
            for tr in rows[1:]:
                cells=tr.xpath('./td')
                if len(cells)!=2:continue
                inputs=cells[0].xpath('.//a[contains(@href,"item=")]')
                if len(inputs)!=1 or ident(inputs[0])!=item['sourceId']:continue
                output=cells[1]
                result['contentsMode']='random' if '隨機' in M.text(output) else 'all'
                for subtr in output.xpath('.//tr'):
                    a=subtr.xpath('./td/a[contains(@href,"item=")]')
                    cs=subtr.xpath('./td')
                    if not a or len(cs)<3 or not ident(a[0]):continue
                    ns=re.findall(r'\d+',M.text(cs[-1]))
                    if not ns:continue
                    result['contents'].append({'sourceId':ident(a[0]),'name':M.text(a[0]),'min':int(ns[0]),'max':int(ns[1] if len(ns)>1 else ns[0])})
        if '可用來製作以下物品' in first:
            for tr in rows[1:]:
                cells=tr.xpath('./td');a=tr.xpath('.//a[contains(@href,"item=")]')
                if a and ident(a[0]) and len(cells)>=3:
                    num=re.search(r'[\d.]+',M.text(cells[-1]))
                    if num:result['usedBy'].append({'sourceId':ident(a[0]),'name':M.text(a[0]),'count':float(num.group())})
        if ('開啟' in first or '打開' in first or '內容物' in first) and len(first)<200:
            for tr in rows[1:]:
                a=tr.xpath('.//a[contains(@href,"item=")]')
                if a and ident(a[0]):result['contents'].append({'sourceId':ident(a[0]),'name':M.text(a[0])})
    return result

def main():
    source=json.loads(M.OUT.read_text())
    rejected=r'k3=(?:fishing|deco|light|quest\d|coin|canuse|holiday|sealrelics|sealrune|rune|tattoo|talisman|energy|tseal|tchange|uitools|addtools)(?:$|&)|k2=(?:spitem|time)&'
    candidates=[i for i in source['items'] if not all(re.search(rejected,c) for c in i['categories'])]
    dest=M.ROOT/'data/ttmi-item-relations.json';out={};failures=[]
    if dest.exists():
        old=json.loads(dest.read_text());out={x['sourceId']:x for x in old.get('items',[])}
    candidates=[i for i in candidates if '--reparse' in sys.argv or i['sourceId'] not in out]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures={pool.submit(get,i):i for i in candidates}
        for f in concurrent.futures.as_completed(futures):
            i=futures[f]
            try:out[i['sourceId']]=f.result()
            except Exception as e:failures.append({'sourceId':i['sourceId'],'error':str(e)})
            if len(out)%100==0:
                print(f'{len(out)} detail tables, {len(failures)} failed',flush=True)
                dest.write_text(json.dumps({'items':sorted(out.values(),key=lambda x:x['sourceId']),'failures':failures},ensure_ascii=False,indent=2)+'\n')
    dest.write_text(json.dumps({'items':sorted(out.values(),key=lambda x:x['sourceId']),'failures':failures},ensure_ascii=False,indent=2)+'\n')
    print('DONE',len(out),len(failures),flush=True)

if __name__=='__main__':main()
