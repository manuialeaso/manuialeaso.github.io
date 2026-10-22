#!/usr/bin/env python3
"""Fetch the public 天堂透視鏡 category tables; retain a local reproducible snapshot.

Usage: python3 scripts/fetch-ttmi-items.py
Dependencies: lxml, opencc-python-reimplemented (only when refreshing from source).
Network reads are limited to www.ttmi.me. No user/account data is requested.
"""
import concurrent.futures
import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from lxml import html
from opencc import OpenCC

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.scratch/ttmi-pages'
OUT = ROOT / 'data/ttmi-items-source.json'
CC = OpenCC('s2twp')
BASE = 'https://www.ttmi.me/'
CACHE.mkdir(parents=True, exist_ok=True)

def normalize(href):
    href = urllib.parse.unquote(href).split('#')[0]
    if href.startswith(BASE):
        href = href[len(BASE):]
    if not href.startswith('index.php-view=item&'):
        return None
    if 'itemclass=' in href or '&item=' in href or '&tag=' in href:
        return None
    if not ('&k3=' in href or href in ['index.php-view=item&k1=normal.htm', 'index.php-view=item&k1=item.htm', 'index.php-view=item&k1=event.htm']):
        return None
    return href

def fetch(path):
    url = BASE + urllib.parse.quote(path, safe='/-_.')
    cache = CACHE / (hashlib.sha256(path.encode()).hexdigest() + '.html')
    if cache.exists():
        data = cache.read_bytes()
    else:
        for attempt in range(3):
            try:
                req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 (compatible; item-reference-check/1.0)'})
                with urllib.request.urlopen(req, timeout=25) as response:
                    data=response.read()
                if b'<html' not in data.lower():
                    raise ValueError('Response is not an HTML document')
                cache.write_bytes(data)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
    return path, url, data

def text(node):
    return CC.convert(' '.join(' '.join(node.itertext()).split()))

def parse(path, url, data):
    page = html.fromstring(data.decode('utf-8', errors='replace'))
    links = {normalize(a) for a in page.xpath('//a/@href')}
    links.discard(None)
    records = []
    for a in page.xpath('//a[contains(@class,"mid1") and contains(@href,"item=")]'):
        name=text(a)
        if not name:
            continue
        m=re.search(r'&item=(\d+)',urllib.parse.unquote(a.get('href')))
        if not m:
            continue
        cell=a.getparent()
        while cell is not None and cell.tag != 'td':
            cell=cell.getparent()
        if cell is None:
            continue
        table=cell.xpath('./div/table')
        if not table:
            continue
        cells=table[0].xpath('./tr/td | ./tbody/tr/td')
        if len(cells)<2:
            continue
        lines = [CC.convert(' '.join(t.split())) for t in cells[1].itertext() if t.strip()]
        records.append({'sourceId':int(m.group(1)),'name':name,'category':path.split('&k1=')[-1].replace('.htm',''),
                        'material':text(cells[0]),'facts':lines,'classes':text(cells[2]) if len(cells)>2 else '',
                        'routes':text(cells[3]) if len(cells)>3 else '',
                        'source': BASE + urllib.parse.quote('index.php-view=item&item='+m.group(1)+'.htm',safe='/-_.'),
                        'categorySource':url})
    return links,records

def main():
    queue={'index.php-view=item&k1=normal.htm','index.php-view=item&k1=item.htm','index.php-view=item&k1=event.htm'}
    seen=set(); pages=[]; all_items={}; failures=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        while queue:
            batch=sorted(queue-seen)
            queue=set()
            if not batch:
                break
            futures={pool.submit(fetch,p):p for p in batch}
            for future in concurrent.futures.as_completed(futures):
                p=futures[future];seen.add(p)
                try:
                    path,url,data=future.result()
                    links,records=parse(path,url,data)
                    queue |= links-seen
                    pages.append({'path':path,'url':url,'sha256':hashlib.sha256(data).hexdigest(),'count':len(records)})
                    for item in records:
                        old=all_items.get(item['sourceId'])
                        if old:
                            old['categories']=sorted(set(old['categories']+[item['category']]))
                        else:
                            item['categories']=[item.pop('category')]
                            all_items[item['sourceId']]=item
                    print(f'{len(seen):3d} pages / {len(all_items):4d} items: {path}',flush=True)
                except Exception as e:
                    failures.append({'path':p,'error':str(e)})
                    print('FAILED',p,str(e),flush=True)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    payload={'source':'天堂透視鏡','mirror':BASE,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
             'pages':sorted(pages,key=lambda x:x['path']),'failures':failures,
             'items':sorted(all_items.values(),key=lambda x:x['sourceId'])}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'pages':len(pages),'items':len(all_items),'failures':len(failures),'output':str(OUT)},ensure_ascii=False))

if __name__=='__main__':
    main()
