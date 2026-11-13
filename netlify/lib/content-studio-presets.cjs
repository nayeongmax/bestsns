const h=require('./content-ai.cjs');
const bucket='content-studio-presets';
function publicPreset(row,video,thumbnail){return{id:row.source_preset_id||'studio_'+row.id,name:row.name,description:row.description,group:'original',version:1,format:row.format,size:row.format==='short'?'9:16':'16:9',fps:'',thumbnail:thumbnail||null,previewUrl:video};}
async function list(db){
 const rows=h.checked(await db.from('content_studio_presets').select('id,source_preset_id,name,description,format,video_path,thumbnail_path').eq('published',true).order('created_at',{ascending:false}));
 return Promise.all(rows.map(async row=>publicPreset(row,h.checked(await db.storage.from(bucket).createSignedUrl(row.video_path,3600)).signedUrl,row.thumbnail_path?h.checked(await db.storage.from(bucket).createSignedUrl(row.thumbnail_path,3600)).signedUrl:null)));
}
async function find(db,id){const q=db.from('content_studio_presets').select('id,source_preset_id,name,format').eq('published',true);const row=h.checked(await (id.startsWith('studio_')?q.eq('id',id.slice(7)):q.eq('source_preset_id',id)).maybeSingle());return row?{id,name:row.name,version:1}:null;}
module.exports={bucket,publicPreset,list,find};
