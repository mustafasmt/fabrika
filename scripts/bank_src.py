# Soru bankası kaynağı → content/bank.json üretir (python3 scripts/bank_src.py)
import json, os

Q = []
def q(id, lang, title, code, options, answer, out, explain, check=None, question=None):
    d = dict(id=id, lang=lang, title=title, code=code, options=options, answer=answer, outputLines=out, explain=explain)
    if question: d["question"] = question
    d["check"] = check or {"stdout": options[answer]}
    Q.append(d)

# ---------------- PYTHON ----------------
q("py01", "python", ["Python", "yuvarlamayı bilmiyor? 🤨"], "print(round(2.5))", ["3", "2", "2.5"], 1,
  ["# → 2", "# round(3.5) → 4  (çifte yuvarlar)"],
  "Python tam ortadaki sayıyı <b>çift</b> olana yuvarlar.<br><span class=\"hl\">2.5 → 2</span> ama <span class=\"hl\">3.5 → 4</span> 🤯")
q("py02", "python", ["Sadece b'yi", "değiştirdim ama… 😳"], "a = [1, 2, 3]\nb = a\nb.append(4)\nprint(a)", ["[1, 2, 3]", "[1, 2, 3, 4]", "Hata verir"], 1,
  ["# → [1, 2, 3, 4]"], "<span class=\"hl\">b = a</span> kopya oluşturmaz, aynı listeye<br>ikinci bir isim verir. b değişince <b>a da değişir</b>.")
q("py03", "python", ["Bilgisayar", "hesap bilmiyor 🤯"], "print(0.1 + 0.2 == 0.3)", ["True", "False", "Hata verir"], 1,
  ["# → False", "# 0.1 + 0.2 = 0.30000000000000004"], "Bilgisayar 0.1'i tam olarak saklayamaz,<br>küçük bir pay kalır → <b>False</b> 😅")
q("py04", "python", ["Çarpma mı,", "kopyalama mı? 🤔"], "print(\"3\" * 3)", ["9", "333", "Hata verir"], 1,
  ["# → 333"], "Metin × sayı = metni o kadar <b>tekrar et</b>.<br><span class=\"hl\">\"3\"</span> bir sayı değil, bir metin!")
q("py05", "python", ["\"False\" yazıyor", "ama… 😵"], "print(bool(\"False\"))", ["True", "False", "Hata verir"], 0,
  ["# → True"], "Boş olmayan <b>her metin</b> True sayılır.<br>İçinde ne yazdığının önemi yok 🙃")
q("py06", "python", ["Varsayılan liste", "tuzağı 🪤"], "def ekle(x=[]):\n    x.append(1)\n    return x\n\nekle()\nprint(ekle())", ["[1]", "[1, 1]", "Hata verir"], 1,
  ["# → [1, 1]"], "Varsayılan liste <b>bir kere</b> oluşturulur<br>ve her çağrıda <span class=\"hl\">aynı liste</span> kullanılır.")
q("py07", "python", ["Bölme", "ikiye ayrıldı ➗"], "print(10 // 3, 10 % 3)", ["3.33 1", "3 1", "3 0"], 1,
  ["# → 3 1"], "<span class=\"hl\">//</span> tam bölme (3), <span class=\"hl\">%</span> kalan (1).<br>İkisi birlikte <b>10 = 3×3 + 1</b>")
q("py08", "python", ["True + True", "= ? 🤨"], "print(True + True)", ["2", "True", "Hata verir"], 0,
  ["# → 2"], "Python'da True aslında <b>1</b>, False <b>0</b>.<br>Yani 1 + 1 = <span class=\"hl\">2</span> 😄")
q("py09", "python", ["Eksi indeks", "var mı ki? 🤔"], "x = [10, 20, 30]\nprint(x[-1])", ["Hata verir", "30", "10"], 1,
  ["# → 30"], "Eksi indeks <b>sondan</b> sayar.<br><span class=\"hl\">x[-1]</span> = son eleman")
q("py10", "python", ["Zincirleme", "karşılaştırma ⛓️"], "print(1 < 2 < 3)", ["True", "False", "Hata verir"], 0,
  ["# → True", "# 1 < 2 and 2 < 3 demek"], "Python <span class=\"hl\">1 &lt; 2 &lt; 3</span> ifadesini<br><b>1 &lt; 2 and 2 &lt; 3</b> diye okur ✅")

# ---------------- WEB (JS + CSS) ----------------
q("web01", "web", ["JavaScript", "toplama bilmiyor? 🤯"], "console.log(0.1 + 0.2)", ["0.3", "0.30000000000000004", "NaN"], 1,
  ["// → 0.30000000000000004"], "Sayılar ikilik sistemde saklanır,<br>0.1 tam yazılamaz → <b>küçük bir pay</b> kalır.")
q("web02", "web", ["Metin + sayı", "= ? 🤔"], "console.log(\"5\" + 3)", ["8", "53", "NaN"], 1,
  ["// → \"53\""], "Bir taraf metinse <span class=\"hl\">+</span> <b>birleştirir</b>.<br>\"5\" + 3 = \"53\"")
q("web03", "web", ["Artı başka,", "eksi başka 😵"], "console.log(\"5\" - 3)", ["2", "53", "NaN"], 0,
  ["// → 2"], "<span class=\"hl\">-</span> metni birleştiremez,<br>\"5\"i <b>sayıya çevirir</b> → 5 - 3 = 2")
q("web04", "web", ["JavaScript'in", "en eski hatası 🐛"], "console.log(typeof null)", ["null", "object", "undefined"], 1,
  ["// → \"object\""], "1995'ten kalma bir hata! Düzeltilemedi çünkü<br><b>internetin yarısı</b> bozulurdu 😅")
q("web05", "web", ["Dizi + dizi", "= ? 🤨"], "console.log([1, 2, 3] + [4])", ["[1,2,3,4]", "1,2,34", "Hata verir"], 1,
  ["// → \"1,2,34\""], "<span class=\"hl\">+</span> dizileri metne çevirir:<br>\"1,2,3\" + \"4\" = <b>\"1,2,34\"</b>")
q("web06", "web", ["sort()", "sayı bilmiyor 😳"], "console.log([10, 1, 2].sort())", ["[1, 2, 10]", "[1, 10, 2]", "[10, 2, 1]"], 1,
  ["// → [1, 10, 2]"], "sort() varsayılan olarak <b>metin gibi</b> sıralar.<br>\"10\", \"2\"den önce gelir! Sayı için <span class=\"hl\">sort((a,b)=&gt;a-b)</span>",
  check={"stdout": "[1, 10, 2]", "normalizeSpaces": True})
q("web07", "web", ["Kendine bile", "eşit değil 🤯"], "console.log(NaN === NaN)", ["true", "false", "Hata verir"], 1,
  ["// → false"], "NaN <b>hiçbir şeye</b> eşit değildir, kendine bile.<br>Kontrol için <span class=\"hl\">Number.isNaN()</span>")
q("web08", "web", ["Hangi kural", "kazanır? 🎨"], "<p id=\"yazi\" class=\"yesil\">Selam</p>\n<style>\n  .yesil { color: green; }\n  #yazi  { color: blue; }\n  p      { color: red; }\n</style>",
  ["Kırmızı", "Mavi", "Yeşil"], 1, ["/* → mavi (#yazi kazandı) */"], "<span class=\"hl\">#id</span> seçicisi, <span class=\"hl\">.class</span> ve etiketten <b>güçlüdür</b>.<br>Sıranın önemi yok!",
  check={"css": {"selector": "#yazi", "prop": "color", "expect": "rgb(0, 0, 255)"}}, question="Yazı hangi renkte görünür?")
Q[-1]["file"] = "index.html"
q("web09", "web", ["!important mı,", "#id mi? 🥊"], "<p id=\"b\" class=\"a\">Selam</p>\n<style>\n  #b { color: blue; }\n  .a { color: red !important; }\n</style>",
  ["Kırmızı", "Mavi", "Siyah"], 0, ["/* → kırmızı (!important) */"], "<span class=\"hl\">!important</span> normal kuralları ezer,<br>#id bile kazanamaz. Az kullan 😅",
  check={"css": {"selector": "#b", "prop": "color", "expect": "rgb(255, 0, 0)"}}, question="Yazı hangi renkte görünür?")
Q[-1]["file"] = "index.html"
q("web10", "web", ["Matematikte doğru,", "JS'te yanlış 😵"], "console.log(1 < 2 < 3, 3 > 2 > 1)", ["true true", "true false", "false false"], 1,
  ["// → true false"], "<span class=\"hl\">3 &gt; 2</span> → true → <b>1</b> olur.<br>Sonra <span class=\"hl\">1 &gt; 1</span> → false 🤯")

# ---------------- RUST ----------------
q("rs01", "rust", ["Aynı isimle", "iki değişken? 🤔"], "let x = 5;\nlet x = x * 2;\nprintln!(\"{}\", x);", ["Derlenmez", "10", "5"], 1,
  ["// → 10"], "Buna <b>shadowing</b> denir: yeni <span class=\"hl\">let</span><br>eski x'in üstüne yeni bir x açar.")
q("rs02", "rust", ["Rust'ta", "sahiplik kavgası ⚔️"], "let s = String::from(\"hi\");\nlet t = s;\nprintln!(\"{}\", s);", ["hi", "boş yazar", "Derlenmez"], 2,
  ["// ✗ error: borrow of moved value: `s`"], "<span class=\"hl\">let t = s</span> sahipliği t'ye <b>taşır</b>.<br>s artık kullanılamaz 🚫",
  check={"compileError": True})
q("rs03", "rust", ["255 + 1", "= ? 🤯"], "let x: u8 = 255;\nprintln!(\"{}\", x.wrapping_add(1));", ["256", "0", "Hata verir"], 1,
  ["// → 0"], "u8 en fazla <b>255</b> tutar.<br><span class=\"hl\">wrapping_add</span> taşınca başa sarar → 0 🔁")
q("rs04", "rust", ["Rust'ta", "bölme 🧮"], "println!(\"{}\", 7 / 2);", ["3.5", "3", "4"], 1,
  ["// → 3"], "İki tam sayı bölünürse sonuç da <b>tam sayı</b>.<br>Ondalık için <span class=\"hl\">7.0 / 2.0</span>")
q("rs05", "rust", ["Eksi sayıda", "mod alınca 😵"], "println!(\"{}\", -7 % 3);", ["2", "-1", "1"], 1,
  ["// → -1  (Python'da 2!)"], "Rust'ta <span class=\"hl\">%</span> sonucu <b>bölünenin işaretini</b> alır.<br>Python'da aynı işlem 2 verir 🤯")
q("rs06", "rust", ["Noktalı virgül", "her şeyi değiştirir 😳"], "let x = { 3; };\nprintln!(\"{:?}\", x);", ["3", "()", "Derlenmez"], 1,
  ["// → ()"], "<span class=\"hl\">3;</span> bir ifade değil, <b>komut</b> olur.<br>Blok hiçbir şey döndürmez → <b>()</b>")
q("rs07", "rust", ["\"héllo\"", "ne kadar uzun? 📏"], "println!(\"{}\", \"héllo\".len());", ["5", "6", "Hata verir"], 1,
  ["// → 6"], "<span class=\"hl\">len()</span> harfi değil <b>baytı</b> sayar.<br>\"é\" UTF-8'de 2 bayt 📦")
q("rs08", "rust", ["x'i 6 yaptım,", "ne yazar? 🤔"], "let x = 5;\nx = 6;\nprintln!(\"{}\", x);", ["6", "5", "Derlenmez"], 2,
  ["// ✗ error: cannot assign twice to immutable variable"], "Rust'ta değişkenler varsayılan olarak <b>değişmez</b>.<br>Çözüm: <span class=\"hl\">let mut x = 5;</span>",
  check={"compileError": True})
q("rs09", "rust", ["match", "ne seçer? 🎯"], "let n = 3;\nlet s = match n {\n    1 => \"bir\",\n    2 | 3 => \"iki-üç\",\n    _ => \"çok\",\n};\nprintln!(\"{}\", s);", ["bir", "iki-üç", "çok"], 1,
  ["// → iki-üç"], "<span class=\"hl\">2 | 3</span> \"2 veya 3\" demek.<br><b>_</b> ise geri kalan her şey 🎯")
q("rs10", "rust", ["Taşma", "yakalandı mı? 🪤"], "let x = i32::MAX.checked_add(1);\nprintln!(\"{}\", x.is_none());", ["true", "false", "Derlenmez"], 0,
  ["// → true"], "<span class=\"hl\">checked_add</span> taşarsa <b>None</b> döner,<br>program çökmez ✅")

# ---------------- ARDUINO ----------------
UNO = "Arduino Uno'da seri monitörde ne görünür?"
SER = "Seri monitörde ne görünür?"
q("ar01", "arduino", ["Arduino", "saymayı unuttu 🤯"], "int x = 32767;\nx = x + 1;\nSerial.println(x);", ["32768", "-32768", "0"], 1,
  ["// → -32768"], "Uno'da <span class=\"hl\">int</span> 16 bittir, en fazla <b>32767</b>.<br>Taşınca eksi tarafa sarar 🔁", question=UNO)
q("ar02", "arduino", ["5 bölü 2", "kaç eder? 🤔"], "Serial.println(5 / 2);", ["2.5", "2", "3"], 1,
  ["// → 2"], "İki tam sayı bölünürse küsurat <b>atılır</b>.<br>Ondalık için <span class=\"hl\">5.0 / 2</span>", question=SER)
q("ar03", "arduino", ["Pi'nin", "yarısı nereye? 🥧"], "Serial.println(3.14159);", ["3.14159", "3.14", "3"], 1,
  ["// → 3.14"], "println ondalıklı sayılarda varsayılan <b>2 basamak</b> yazar.<br>Hepsi için <span class=\"hl\">Serial.println(x, 5)</span>", question=SER)
q("ar04", "arduino", ["255'ten", "sonra ne gelir? 🔁"], "byte b = 255;\nb++;\nSerial.println(b);", ["256", "0", "-1"], 1,
  ["// → 0"], "<span class=\"hl\">byte</span> 0–255 arası tutar.<br>255'ten sonra <b>başa sarar</b> → 0", question=SER)
q("ar05", "arduino", ["Döngü", "kaç kere döner? 🔄"], "for (int i = 0; i < 3; i++) {\n  Serial.print(i);\n}", ["123", "012", "0123"], 1,
  ["// → 012"], "Sayaç <b>0'dan</b> başlar, 3 olunca durur.<br>Yani 0, 1, 2 → <span class=\"hl\">012</span>", question=SER)
q("ar06", "arduino", ["Harfe", "1 ekledim 🔤"], "Serial.println('A' + 1);", ["B", "66", "A1"], 1,
  ["// → 66"], "Harfler aslında <b>sayıdır</b>: 'A' = 65.<br>Toplama sonucu int olur → <span class=\"hl\">66</span>", question=SER)
q("ar07", "arduino", ["Metne", "sayı ekledim ➕"], "String s = \"LED\";\ns += 13;\nSerial.println(s);", ["LED13", "LED", "Hata verir"], 0,
  ["// → LED13"], "<span class=\"hl\">String</span> nesnesine sayı eklenince<br>sayı <b>metne çevrilip</b> sona yapışır.", question=SER)
q("ar08", "arduino", ["Tek eşittir", "büyük hata 🪤"], "int x = 10;\nif (x = 5) {\n  Serial.println(\"evet\");\n} else {\n  Serial.println(\"hayır\");\n}", ["hayır", "evet", "Hata verir"], 1,
  ["// → evet"], "<span class=\"hl\">=</span> karşılaştırmaz, <b>atama</b> yapar!<br>x = 5 olur, 5 de doğru sayılır. Doğrusu: <span class=\"hl\">==</span>", question=SER)
q("ar09", "arduino", ["1 dakika", "kaç milisaniye? ⏱️"], "Serial.println(1000 * 60);", ["60000", "-5536", "0"], 1,
  ["// → -5536"], "Uno'da sayılar 16 bit <b>int</b>: 60000 sığmaz, taşar.<br>Çözüm: <span class=\"hl\">1000UL * 60</span>",
  check={"int16": "1000 * 60", "stdout": "-5536"}, question=UNO)
q("ar10", "arduino", ["int", "kaç bayt? 📦"], "Serial.println(sizeof(int));", ["4", "2", "8"], 1,
  ["// → 2"], "Bilgisayarda int 4 bayt ama <b>Uno'da 2 bayt</b>.<br>Bu yüzden en fazla 32767 tutar.", question=UNO)

os.makedirs("content", exist_ok=True)
json.dump(Q, open("content/bank.json", "w"), ensure_ascii=False, indent=1)
print(len(Q), "soru yazıldı")
