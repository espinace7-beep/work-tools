"""Assign form columns from verified catalog categories and named equipment families.
Prices, names and original catalog categories are preserved.
"""
from pathlib import Path
import json,re
p=Path(__file__).resolve().parents[1]/'catalog.json';data=json.loads(p.read_text())
for item in data['items']:
 n=item['name'];i=int(item['id'][1:]);cat=item['cat'];column={0:0,1:1,2:1,3:2,4:3,5:3}[cat];role='その他'
 if cat==0:role='ライト・灯体アクセサリー'
 if cat==1:role='スタンド'
 if cat==2:
  role='グリップ'
  if i in [18,19,20,76,167,168,656,667,668,1956,1957] or 332<=i<=382 and i!=355 or 1354<=i<=1844 or 1929<=i<=1931:
   column=0;role='灯体アクセサリー'
  if re.search(r'ウエイト|脚立|ハシゴ|ラダー|ドーリー|円形レール|直線レール|トラス|イントレ|ブレース|ジャッキ|ブーメラン|箱馬|キャリー|マグライナー|リヤカー|テント',n):column=3;role='設営・その他'
  if column==0 and re.search(r'スタンド|ハイボーイ',n):column=1;role='スタンド'
  if column==0 and re.search(r'延長コード|DMXケーブル|バッテリー|パワーアダプター|DCアダプター|Power Station|バラスト|ディマー',n,re.I):column=2;role='電源・ケーブル'
  if re.search(r'^EB|^\d+(?:/\d+)?EB|ビリビリガード|繰り返しタイマー',n):column=2;role='電源・制御'
 if cat==3:role='電源・ケーブル'
 if cat==4:role='フレーム・クロス'
 if cat==5 and re.search(r'DMX|調光|ディマー|レプリコン|Lumen Radio|ユニット',n,re.I):column=2;role='電源・制御'
 # Catalog entries outside their main section.
 if n=='24V バッテリーフォーカシングライト 200W':column=0;role='ライト'
 if n=='MQクランプ':column=1;role='グリップ'
 if n in ['DMX調光卓 レプリコン','DMX延長コード','ハイパーブラスト用中間コード']:column=2;role='電源・制御'
 if '点灯料' in n:column=3;role='別料金'
 item['column']=column;item['role']=role
p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print('Assigned columns:',{c:sum(i['column']==c for i in data['items']) for c in range(4)})
