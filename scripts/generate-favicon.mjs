import fs from 'node:fs';

import sharp from 'sharp';

const source='public/catagories_icons/motocrossbike_icon.png';
const out='public/icons';
fs.mkdirSync(out,{recursive:true});
fs.mkdirSync('.tools',{recursive:true});
// Crop only empty alpha padding; keep the source proportions and original silhouette.
const cropped=await sharp(source).extract({left:28,top:277,width:1208,height:710}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let i=0;i<cropped.data.length;i+=4){cropped.data[i]=250;cropped.data[i+1]=249;cropped.data[i+2]=246;}
const art=await sharp(cropped.data,{raw:cropped.info}).png().toBuffer();
const sizes=[16,32,48,180,192,512];
for(const size of sizes){
 const bike=await sharp(art).resize(Math.round(size*.9),Math.round(size*.9),{fit:'inside',kernel:'lanczos3'}).png().toBuffer();
 const tile=Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${size*.16}" fill="#78543D"/></svg>`);
 await sharp(tile).composite([{input:bike,gravity:'centre'}]).png().toFile(`${out}/${size===180?'apple-touch-icon':`favicon-${size}`}.png`);
}
// Standard ICO directory containing lossless PNG payloads for modern browsers/Windows.
const payloads=[16,32,48].map(s=>fs.readFileSync(`${out}/favicon-${s}.png`));
const header=Buffer.alloc(6+16*payloads.length);header.writeUInt16LE(1,2);header.writeUInt16LE(payloads.length,4);
let offset=header.length;payloads.forEach((p,i)=>{const e=6+16*i;header[e]=[16,32,48][i];header[e+1]=header[e];header.writeUInt16LE(1,e+4);header.writeUInt16LE(32,e+6);header.writeUInt32LE(p.length,e+8);header.writeUInt32LE(offset,e+12);offset+=p.length;});
fs.writeFileSync('src/app/favicon.ico',Buffer.concat([header,...payloads]));
const data=p=>`data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
const preview=theme=>`<section class="${theme}"><h2>${theme} theme</h2><div class="tab"><img width="16" height="16" src="${data(out+'/favicon-16.png')}"> ThrottleHub <span>×</span></div><div class="sizes">${[16,32,48].map(s=>`<figure><img width="${s}" height="${s}" src="${data(out+`/favicon-${s}.png`)}"><figcaption>${s} × ${s}</figcaption></figure>`).join('')}<figure><img width="128" height="128" src="${data(out+'/favicon-512.png')}"><figcaption>Large preview</figcaption></figure></div></section>`;
fs.writeFileSync('.tools/favicon-preview.html',`<!doctype html><html lang="en"><meta charset="utf-8"><title>ThrottleHub favicon preview — local only</title><style>body{font:16px Arial;margin:40px;background:#F3EEE6;color:#272725}h1{font-size:26px}section{padding:24px;border-radius:16px;margin:20px 0}.light{background:#FAF9F6}.dark{background:#272725;color:#FAF9F6}.sizes{display:flex;align-items:center;gap:36px;min-height:180px}figure{margin:0;text-align:center}figcaption{font-size:12px;margin-top:12px}.tab{display:flex;align-items:center;gap:10px;width:220px;padding:12px;border:1px solid #888;border-radius:12px 12px 0 0}.tab span{margin-left:auto}.source{background:#FAF9F6;border-radius:12px}</style><h1>ThrottleHub favicon</h1><p>Local development preview. Tiny icons below render at their actual pixel sizes.</p><h2>Original artwork (unchanged)</h2><img class="source" width="280" height="280" src="${data(source)}">${preview('light')}${preview('dark')}</html>`);
// Raster contact sheet for local visual verification at actual icon sizes.
const sheet=Buffer.from(`<svg width="760" height="360" xmlns="http://www.w3.org/2000/svg"><rect width="760" height="180" fill="#FAF9F6"/><rect y="180" width="760" height="180" fill="#272725"/></svg>`);
const overlays=[];for(const top of [40,220])for(const [i,s]of [16,32,48,128].entries()){overlays.push({input:await sharp(`${out}/favicon-${s===128?512:s}.png`).resize(s,s).toBuffer(),left:30+i*180,top});}
await sharp(sheet).composite(overlays).png().toFile('.tools/favicon-contact-sheet.png');
console.log('Generated icons, multi-resolution ICO and local-only preview.');
