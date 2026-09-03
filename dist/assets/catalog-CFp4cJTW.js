import{c as at}from"./index-8ufTItJR.js";const st="https://eojfpequxoxunmxejquy.supabase.co",lt="sb_publishable_4ZGyINuBEt8X5TMYtRgqyg_Qy8O6IZG",D=st,G=lt;let g=null;function ct(e){let t=(e||"").replace(/\D/g,"");for(;t.startsWith("0");)t=t.substring(1);return t.startsWith("90")&&t.length===12?t:t.length===10&&t.startsWith("5")?"90"+t:t}let v="",A=[],k={},p=[],x=null,m=null,u=0;const dt=document.getElementById("lbl-catalog-company"),S=document.getElementById("catalog-products-container"),pt=document.getElementById("lbl-cart-count"),_=document.getElementById("product-options-modal"),H=document.getElementById("cart-modal"),mt=document.getElementById("opt-modal-title"),N=document.getElementById("opt-modal-img"),ut=document.getElementById("opt-modal-code"),gt=document.getElementById("opt-modal-badges"),K=document.getElementById("opt-modal-price"),T=document.getElementById("opt-color-select"),C=document.getElementById("opt-sizes-tbody"),et=document.getElementById("opt-total-qty"),Y=document.getElementById("cart-items-list"),V=document.getElementById("cart-grand-total");async function O(){const e=new URLSearchParams(window.location.search);if(v=e.get("w"),!v){S.innerHTML=`
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--color-danger);">
        <span style="font-size: 3rem; display: block; margin-bottom: 12px;">⚠️</span>
        <h3>Hatalı Katalog Bağlantısı</h3>
        <p style="font-size: 13px; margin-top: 6px;">Katalog linki eksik veya hatalı. Lütfen size linki gönderen atölye ile iletişime geçin.</p>
      </div>
    `;return}dt.textContent=v;try{if(D&&G&&D!==""){const t=btoa(unescape(encodeURIComponent(v)));g=at(D,G,{global:{headers:{"x-company-id":t}}})}}catch(t){console.error("Supabase initialization failed in catalog:",t)}if(!g){S.innerHTML=`
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--color-warning);">
        <span style="font-size: 3rem; display: block; margin-bottom: 12px;">🔌</span>
        <h3>Bulut Veritabanı Bağlantısı Yok</h3>
        <p style="font-size: 13px; margin-top: 6px;">Bu atölye için aktif bir Supabase bağlantısı tanımlanmamış.</p>
      </div>
    `;return}try{const{data:t,error:o}=await g.from("products").select("*").eq("data->>_ownerCompany",v);if(o)throw o;A=(t||[]).map(i=>{const n={...i.data};return n.id=Number(i.id),n});const a=e.get("c");if(a)try{const{data:i,error:n}=await g.from("contacts").select("*").eq("id",parseInt(a)).maybeSingle();if(n)throw n;if(i){m={...i.data,id:Number(i.id)},u=m.discountRate||0,console.log(`B2B Client identified: ${m.name} with discount: %${u}`);const r=document.querySelector(".catalog-title p");r&&(r.innerHTML=`Sayın <strong>${c(m.name)}</strong> için Özel B2B Sipariş Portalı ${u>0?`(<span style="color: #10b981; font-weight: 700;">%${u} İskontolu</span>)`:""}`)}}catch(i){console.warn("Could not load B2B client custom details:",i)}if(A.length===0){S.innerHTML=`
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #9ca3af;">
          <span style="font-size: 3rem; display: block; margin-bottom: 12px;">👡</span>
          <h3>Katalogda Ürün Bulunmuyor</h3>
          <p style="font-size: 13px; margin-top: 6px;">Bu atölye henüz kataloğa ürün eklememiş.</p>
        </div>
      `;return}k={},A.forEach(i=>{const n=i.modelCode||"KODSUZ";k[n]||(k[n]=[]),k[n].push(i)}),yt()}catch(t){console.error(t),S.innerHTML=`
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--color-danger);">
        <span style="font-size: 3rem; display: block; margin-bottom: 12px;">❌</span>
        <h3>Katalog Yüklenemedi</h3>
        <p style="font-size: 13px; margin-top: 6px;">Veri çekme hatası: ${t.message}</p>
      </div>
    `}}function yt(){S.innerHTML=Object.keys(k).map(e=>{const t=k[e],o=t.find(r=>r.photo)||t[0],a=o.category?`<span class="info-badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">${c(o.category)}</span>`:"",i=o.soleMaterial?`<span class="info-badge">${c(o.soleMaterial)}</span>`:"",n=t.map(r=>c(r.color)).join(", ");return`
      <div class="product-card">
        <div class="product-img-container">
          ${o.photo?`<img src="${o.photo}" class="product-img" alt="${c(e)}">`:'<span class="product-img-placeholder">👟</span>'}
        </div>
        <div class="product-details">
          <h3>${c(e)}</h3>
          <div class="product-info-row">
            ${a}
            ${i}
          </div>
          <p style="font-size: 11.5px; color: #9ca3af; margin: 0 0 14px 0; line-height: 1.4;">
            <strong>Renkler:</strong> ${n}
          </p>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
            <div style="display: flex; flex-direction: column;">
              ${u>0?`<span class="product-price-original" style="text-decoration: line-through; color: #9ca3af; font-size: 0.75rem; line-height: 1;">₺${Number(o.price||0).toLocaleString("tr-TR",{minimumFractionDigits:2})}</span>
                   <span class="product-price" style="color: #10b981; font-weight: 800; font-size: 1.1rem; margin-top: 2px;">₺${Number((o.price||0)*(1-u/100)).toLocaleString("tr-TR",{minimumFractionDigits:2})}</span>`:`<span class="product-price">₺${Number(o.price||0).toLocaleString("tr-TR",{minimumFractionDigits:2})}</span>`}
            </div>
            <button type="button" class="btn btn-primary btn-sm btn-select-product" onclick="window.selectProduct('${c(e)}')">
              Sipariş Ver
            </button>
          </div>
        </div>
      </div>
    `}).join("")}function ft(e){if(x=k[e],!x||x.length===0)return;const t=x.find(o=>o.photo)||x[0];mt.textContent=`${e} - Sipariş Yapılandır`,ut.textContent=e,t.photo?(N.src=t.photo,N.style.display="block"):N.style.display="none",gt.innerHTML=`
    ${t.category?`<span class="info-badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">${c(t.category)}</span>`:""}
    ${t.soleMaterial?`<span class="info-badge">${c(t.soleMaterial)}</span>`:""}
  `,T.innerHTML=x.map(o=>`<option value="${o.id}">${c(o.color)}</option>`).join(""),T.onchange=()=>{J()},J(),L(_)}function J(){const e=parseInt(T.value),t=x.find(n=>n.id===e);if(!t)return;if(u>0){const n=Number(t.price||0),r=n*(1-u/100);K.innerHTML=`
      <span style="text-decoration: line-through; color: #9ca3af; font-size: 0.8rem; margin-right: 6px;">₺${n.toLocaleString("tr-TR",{minimumFractionDigits:2})}</span>
      <span style="color: #10b981; font-weight: 800;">₺${r.toLocaleString("tr-TR",{minimumFractionDigits:2})}</span>
    `}else K.textContent=`₺${Number(t.price||0).toLocaleString("tr-TR",{minimumFractionDigits:2})}`;let o=[];const i=(t.size||"36-44").split("-");if(i.length===2){const n=parseInt(i[0]),r=parseInt(i[1]);if(!isNaN(n)&&!isNaN(r)&&n<=r&&n>=20&&r<=55)for(let d=n;d<=r;d++)o.push(d.toString())}o.length===0&&(o=["36","37","38","39","40","41","42","43","44"]),C.innerHTML=o.map(n=>`
    <tr class="size-input-row">
      <td style="font-weight: 700; color: var(--text-accent);">${n}</td>
      <td>
        <input type="number" class="txt-size-qty" data-size="${n}" min="0" value="0" style="width: 80px;">
      </td>
    </tr>
  `).join(""),et.textContent="0 Çift",C.querySelectorAll(".txt-size-qty").forEach(n=>{n.addEventListener("input",()=>{bt()})})}function bt(){let e=0;C.querySelectorAll(".txt-size-qty").forEach(t=>{e+=parseInt(t.value)||0}),et.textContent=`${e} Çift`}function ht(){const e=parseInt(T.value),t=x.find(n=>n.id===e);if(!t)return;const o=[];let a=0;if(C.querySelectorAll(".txt-size-qty").forEach(n=>{const r=parseInt(n.value)||0;r>0&&(o.push({size:n.dataset.size,qty:r}),a+=r)}),a===0){alert("Lütfen en az bir beden için adet girin!");return}const i=p.findIndex(n=>n.productId===e);i>-1?(o.forEach(n=>{const r=p[i].sizes.find(d=>d.size===n.size);r?r.qty+=n.qty:p[i].sizes.push(n)}),p[i].qty+=a):p.push({id:Date.now().toString(),productId:t.id,modelCode:t.modelCode,color:t.color,price:u>0?(t.price||0)*(1-u/100):t.price||0,originalPrice:t.price||0,sizes:o,qty:a}),R(),$(_),wt(`Sepete Eklendi: ${t.modelCode} (${t.color}) - ${a} Çift`)}function R(){let e=0;p.forEach(t=>e+=t.qty),pt.textContent=e}function nt(){if(p.length===0){Y.innerHTML=`
      <div style="padding: 30px; text-align: center; color: #9ca3af;">
        <span>🛒</span> Sepetiniz boş.
      </div>
    `,V.textContent="0 Çift";return}Y.innerHTML=p.map(t=>{const o=t.sizes.map(a=>`${a.size}:${a.qty}`).join(", ");return`
      <div class="cart-item">
        <div class="cart-item-details">
          <h4>${c(t.modelCode)} (${c(t.color)})</h4>
          <p>${c(o)}</p>
        </div>
        <div class="cart-item-actions">
          <strong style="color: var(--accent-primary); font-size: 0.9rem;">${t.qty} Çift</strong>
          <button type="button" class="btn-icon danger" onclick="window.removeFromCart('${t.id}')" style="cursor: pointer;">🗑️</button>
        </div>
      </div>
    `}).join("");let e=0;p.forEach(t=>e+=t.qty),V.textContent=`${e} Çift`}function xt(e){p=p.filter(t=>t.id!==e),R(),nt()}async function vt(e){if(e.preventDefault(),p.length===0){alert("Sepetiniz boş!");return}const t=document.getElementById("btn-submit-order");t.disabled=!0,t.innerHTML="⏳ Siparişiniz Gönderiliyor...";const o=document.getElementById("txt-buyer-name").value.trim(),a=document.getElementById("txt-buyer-phone").value.trim(),i=document.getElementById("txt-buyer-note").value.trim();try{let n="";const{data:r}=await g.from("settings").select("*").eq("id","manager_b2b_settings").maybeSingle();if(r&&r.data&&r.data.phone){let s=r.data.phone.replace(/\D/g,"");s.startsWith("0")&&(s=s.substring(1)),s.length===10?n="90"+s:n=s}const d={};p.forEach(s=>{const f=s.modelCode;d[f]||(d[f]=[]),d[f].push(s)});const y=JSON.parse(localStorage.getItem("my_catalog_orders")||"[]");for(const s in d){const f=d[s],q=f.map(b=>({productId:b.productId,color:b.color,qty:b.qty,sizes:b.sizes})),I=f.reduce((b,E)=>b+E.qty,0),it=f[0].price,P=Math.floor(1e5+Math.random()*9e5);let W="";try{if("serviceWorker"in navigator&&"PushManager"in window){const E=await(await navigator.serviceWorker.ready).pushManager.getSubscription();E&&(W=E.endpoint)}}catch(b){console.warn("Could not read client subscription endpoint:",b)}const rt={id:P,contactId:m?m.id:0,customerName:m?m.name:o,customerPhone:m?m.phone:a,modelCode:s,price:it,qty:I,colors:q,status:"gelen",date:new Date().toISOString(),deadline:new Date().toISOString(),note:i,_ownerCompany:v,clientPushEndpoint:W},{error:U}=await g.from("orders").insert({id:P,data:rt});if(U)throw U;y.push(P)}localStorage.setItem("my_catalog_orders",JSON.stringify(y));let l=`*ATÖLYECİM B2B SİPARİŞİ* 👟
`;l+=`*Alıcı Atölye:* ${v}
`,l+=`*Gönderen Firma:* ${m?m.name:o}
`,m&&(l+=`*Müşteri Hesabı:* Kayıtlı Cari Müşteri
`,u>0&&(l+=`*Uygulanan İskonto:* %${u}
`)),l+=`*Tarih:* ${new Date().toLocaleDateString("tr-TR")}
`,l+=`---------------------------

`;let h=0,w=0;p.forEach(s=>{l+=`*Model:* ${s.modelCode} (${s.color})
`;const f=s.sizes.map(I=>`${I.size} Nmr: ${I.qty} Ad`).join(", ");l+=`└ _Bedenler:_ ${f}
`;const q=u>0?` (~₺${s.originalPrice.toFixed(2)}~)`:"";l+=`└ *Birim Fiyat:* ₺${s.price.toFixed(2)}${q}
`,l+=`└ *Miktar:* ${s.qty} Çift

`,h+=s.qty,w+=s.qty*s.price}),l+=`---------------------------
`,l+=`*GENEL TOPLAM:* *${h} Çift*
`,l+=`*TOPLAM TUTAR:* *₺${w.toLocaleString("tr-TR",{minimumFractionDigits:2})}*
`,i&&(l+=`*Sipariş Notu:* ${i}
`),p=[],R(),$(H),document.getElementById("cart-checkout-form").reset();const B=encodeURIComponent(l);let z="";n?z=`https://api.whatsapp.com/send?phone=${ct(n)}&text=${B}`:z=`https://api.whatsapp.com/send?text=${B}`;const M=document.getElementById("checkout-success-modal"),j=document.getElementById("btn-success-ok");M&&j?(L(M),j.onclick=()=>{window.open(z,"_blank"),$(M),O()}):(window.open(z,"_blank"),O())}catch(n){console.error(n),alert("Sipariş gönderilirken veritabanı hatası oluştu: "+n.message)}finally{t.disabled=!1,t.innerHTML="✔️ Siparişi WhatsApp ve Panel Üzerinden Gönder"}}function L(e){e&&(e.style.display="flex",requestAnimationFrame(()=>e.classList.add("show")))}function $(e){e&&(e.classList.remove("show"),setTimeout(()=>{e.style.display="none"},250))}function c(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}function wt(e){const t=document.getElementById("catalog-toast");t&&(t.textContent=e,t.style.display="block",setTimeout(()=>{t.style.display="none"},3e3))}async function kt(){const e=document.getElementById("client-orders-list");if(!e)return;const t=JSON.parse(localStorage.getItem("my_catalog_orders")||"[]");if(t.length===0){e.innerHTML=`
      <div style="padding: 40px 20px; text-align: center; color: #9ca3af;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 10px;">📋</span>
        Henüz geçmiş siparişiniz bulunmuyor.
      </div>
    `;return}e.innerHTML=`
    <div style="padding: 20px; text-align: center; color: #9ca3af;">
      ⏳ Sipariş durumları güncelleniyor...
    </div>
  `;try{const{data:o,error:a}=await g.from("orders").select("*").in("id",t);if(a)throw a;const i=(o||[]).map(n=>{const r={...n.data};return r.id=Number(n.id),r});if(i.length===0){e.innerHTML=`
        <div style="padding: 40px 20px; text-align: center; color: #9ca3af;">
          Sipariş kaydı veritabanında bulunamadı.
        </div>
      `;return}i.sort((n,r)=>new Date(r.date)-new Date(n.date)),e.innerHTML=i.map(n=>{const r=n.date?new Date(n.date).toLocaleDateString("tr-TR"):"-";let d="Onay Bekliyor",y="#3b82f6";n.status==="beklemede"?(d="Üretimde (Aktif)",y="#f59e0b"):n.status==="tamamlandi"?(d="Teslim Edildi",y="#10b981"):n.status==="iptal"&&(d="İptal Edildi",y="#ef4444");const l=(n.colors||[]).map(h=>{let w="";return h.sizes&&h.sizes.length>0&&(w=h.sizes.map(B=>`${B.size}:${B.qty}`).join(", "),w=` [${w}]`),`${c(h.color)}: ${h.qty} Çift${w}`}).join(" | ");return`
        <div style="padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span style="font-size: 0.8rem; color: #9ca3af;">Sipariş No: <strong>#${n.id}</strong></span>
              <span style="font-size: 0.75rem; color: #6b7280; margin-left: 10px;">${r}</span>
            </div>
            <span style="font-size: 11px; font-weight: 700; background: ${y}1A; color: ${y}; padding: 3px 8px; border-radius: 9999px; border: 1px solid ${y}33;">
              ${d}
            </span>
          </div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 4px;">
            Model: ${c(n.modelCode)}
          </div>
          <div style="font-size: 0.8rem; color: #d1d5db; line-height: 1.4;">
            ${c(l)}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.85rem; border-top: 1px dashed rgba(255,255,255,0.03); padding-top: 8px;">
            <span style="color: #9ca3af;">Toplam: <strong>${n.qty} Çift</strong></span>
            <span style="color: #10b981; font-weight: 800;">₺${Number(n.price*n.qty).toLocaleString("tr-TR",{minimumFractionDigits:2})}</span>
          </div>
        </div>
      `}).join("")}catch(o){console.error(o),e.innerHTML=`
      <div style="padding: 30px; text-align: center; color: var(--color-danger);">
        Durumlar güncellenemedi: ${c(o.message)}
      </div>
    `}}const F=document.getElementById("client-orders-modal");document.getElementById("btn-close-opt-modal").onclick=()=>$(_);document.getElementById("btn-close-cart-modal").onclick=()=>$(H);document.getElementById("btn-open-cart").onclick=()=>{nt(),L(H)};document.getElementById("btn-add-to-cart").onclick=ht;document.getElementById("cart-checkout-form").onsubmit=vt;const Q=document.getElementById("btn-open-orders");Q&&(Q.onclick=()=>{kt(),L(F)});const Z=document.getElementById("btn-close-client-orders-modal");Z&&(Z.onclick=()=>$(F));const X=document.getElementById("btn-close-client-orders-modal-bottom");X&&(X.onclick=()=>$(F));window.selectProduct=ft;window.removeFromCart=xt;"serviceWorker"in navigator&&navigator.serviceWorker.register("./sw.js").then(e=>{console.log("ServiceWorker registered in catalog successfully:",e.scope)}).catch(e=>{console.warn("ServiceWorker registration failed in catalog:",e)});function $t(e){const t="=".repeat((4-e.length%4)%4),o=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),a=window.atob(o),i=new Uint8Array(a.length);for(let n=0;n<a.length;++n)i[n]=a.charCodeAt(n);return i}async function ot(){const e=document.getElementById("btn-push-bell");if(e){if(!("serviceWorker"in navigator)||!("PushManager"in window)){e.style.display="none";return}try{await(await navigator.serviceWorker.ready).pushManager.getSubscription()?(e.style.background="rgba(16, 185, 129, 0.1)",e.style.color="#10b981",e.style.borderColor="rgba(16, 185, 129, 0.2)",e.title="Anlık Bildirimler Açık 🟢 (Kapatmak için tıklayın)"):(e.style.background="rgba(245, 158, 11, 0.1)",e.style.color="#f59e0b",e.style.borderColor="rgba(245, 158, 11, 0.2)",e.title="Anlık Bildirimleri Aç 🔔")}catch(t){console.warn(t)}}}async function Bt(){const e=document.getElementById("btn-push-bell");if(e){e.disabled=!0;try{const t=await navigator.serviceWorker.ready,o=await t.pushManager.getSubscription();if(o)await o.unsubscribe(),g&&await g.from("push_subscriptions").delete().eq("endpoint",o.endpoint),alert("Bildirim aboneliği kapatıldı.");else{const a="BG1947QNf0x6COBkxo4HX129RGPSMnWgdNq453kRFVV4CSaPYojaFBG95Tm9DMetWkdqR2PxiL0pWQZt4rwoXZk";if(await Notification.requestPermission()!=="granted"){alert("Bildirim izni reddedildi. Ayarlarınızdan bildirimlere izin vermeniz gerekir."),e.disabled=!1;return}const n=await t.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:$t(a)}),r={endpoint:n.endpoint,keys:JSON.parse(JSON.stringify(n.toJSON().keys)),workshop_id:v||"default_workshop",user_type:"client"};g&&await g.from("push_subscriptions").insert([r]),alert("Harika! Siparişiniz onaylandığında veya durum değişiminde anlık bildirim alacaksınız. 🔔")}await ot()}catch(t){console.error(t),alert("Abonelik hatası: "+t.message)}finally{e.disabled=!1}}}const tt=document.getElementById("btn-push-bell");tt&&(tt.onclick=Bt,setTimeout(ot,1e3));O();
