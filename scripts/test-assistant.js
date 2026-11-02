/* Checks that the assistant's answers still match the known questions:  node scripts/test-assistant.js */
const path=require('path');
const core=require(path.join(__dirname,'..','assistant-core.js'));
const kb=JSON.parse(require('fs').readFileSync(path.join(__dirname,'..','assistant-kb.json'),'utf8'));
const T=[
 ['ما هي خدماتكم؟','ar','services'],['شنو تسوون','ar','services'],['ما هي أسعاركم','ar','prices'],['شكد سعر الدورات؟','ar','prices'],
 ['كم سعر دورة ريفت','ar','program'],['ريفت','ar','program'],['سعر الاوتوكاد','ar','program'],['كم مدة دورة لوميون','ar','program'],
 ['عندكم دورات؟','ar','courses'],['اريد اصمم بيتي','ar','design'],['هل تصممون مشاريع الطلاب','ar','design'],['كيف اسجل بالمنصة','ar','register'],
 ['كيف اتواصل معكم','ar','contact'],['رقمكم','ar','contact'],['اريد اتكلم مع شخص','ar','contact'],['هل في خصم؟','ar','offers'],
 ['شنو يشمل الاشتراك','ar','includes'],['كم مدة الدورة','ar','duration'],['شنو البرامج اللي تدرسونها','ar','programs'],['ما الفرق بين الدورة التفاعلية والمسجلة','ar','types'],
 ['وين اشوف المسابقات','ar','competitions'],['عندكم برومبتات','ar','ai'],['كتب مجانية','ar','library'],['اخبار العمارة','ar','news'],
 ['اريد نقد لمشروعي','ar','critique'],['اشراف على مشروع التخرج','ar','supervision'],['كم سعر الإظهار','ar','prices'],['دورة اظهار','ar','courses'],
 ['سلام عليكم','ar','greet'],['شكرا','ar','thanks'],['من انتم','ar','about'],['اعمال الطلاب','ar','works'],['المجتمع','ar','community'],
 ['what are your prices','en','prices'],['How much is the Revit course?','en','program'],['what services do you offer','en','services'],['hello','en','greet'],
 ['do you design student projects','en','design'],['how to join','en','register'],['free books','en','library'],['contact','en','contact'],
 ['fiyatlar nedir','tr','prices'],['Revit kursu kaç para','tr','program'],['hizmetleriniz neler','tr','services'],['kayıt olmak istiyorum','tr','register'],
 ['quels sont vos tarifs','fr','prices'],['combien coûte le cours Lumion','fr','program'],['vos services','fr','services'],['comment m’inscrire','fr','register'],
 ['نرخەکان چەندە','ku','prices'],['خزمەتگوزارییەکانتان چین','ku','services'],['چۆن تۆمار بکەم','ku','register'],['سڵاو','ku','greet'],
 ['asdf qwer','ar','fallback'],['ما هو لون السماء','ar','fallback'],
];
let bad=0;
for(const [q,l,exp] of T){const r=core.answer(kb,q,l);const ok=r.id===exp;if(!ok){bad++;console.log('FAIL',JSON.stringify(q),'->',r.id,'expected',exp)}}
console.log('total',T.length,'failed',bad);
// language detection
const D=[['كم الاسعار','ar'],['what are the prices','en'],['fiyatlar ne kadar','tr'],['quels sont les tarifs','fr'],['نرخەکان چەندە','ku'],['hello','en'],['merhaba','tr'],['bonjour','fr']];
let lb=0;for(const [q,e] of D){const g=core.detect(kb,q);if(g!==e){lb++;console.log('LANG FAIL',q,g,e)}}
console.log('language checks',D.length,'failed',lb);
process.exit(bad||lb?1:0);
