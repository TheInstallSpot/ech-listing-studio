/* ECH listing HTML generator — extracted verbatim from ECHlistingbuilder.html */
"use strict";
function esc(s){
    return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ---------------- repeatable rows
  var CONDS = {
    N1:{label:"New \u00b7 Unused", tagBg:"#1839B4", border:"#1839B4", text:"#1839B4"},
    O2:{label:"Used \u00b7 Opened gear",  tagBg:"#0F1318", border:"#22282F", text:"#22282F"},
    D3:{label:"Dealer demo \u00b7 Tested", tagBg:"#7C5F22", border:"#7C5F22", text:"#7C5F22"}
  };

  var F_HEAD = "Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif";
  var F_BODY = "Georgia,'Times New Roman',serif";
  var F_MONO = "'SF Mono',Consolas,'Courier New',monospace";

  // Static store-level tail — credential band, categories, about, reviews, policies.
  // Lifted verbatim from ech-listing-template-v2.html so the two cannot drift.
  var TAIL = `<div style="margin:0 0 30px;padding:13px 16px;text-align:center;background:#FAF7EF;border-top:2px solid #9C7B34;border-bottom:2px solid #9C7B34;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:#7C5F22;">Authorized dealer &middot; Est. 2006 &middot; On eBay since 2021</div>

  
  <h2 style="margin:0 0 14px;padding:0 0 8px;border-bottom:2px solid #14181D;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#14181D;">Shop by category</h2>
  <div style="margin:0 0 28px;">
    <a href="https://www.ebay.com/str/theelectronicsclearinghouse/_i.html?store_cat=48882154018" style="display:inline-block;width:152px;margin:0 6px 6px 0;padding:12px 10px;background:#F4F5F1;border-left:3px solid #1E45D8;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#14181D;text-decoration:none;vertical-align:top;">In-Wall &amp; In-Ceiling</a><a href="https://www.ebay.com/str/theelectronicsclearinghouse/_i.html?store_cat=49503339018" style="display:inline-block;width:152px;margin:0 6px 6px 0;padding:12px 10px;background:#F4F5F1;border-left:3px solid #1E45D8;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#14181D;text-decoration:none;vertical-align:top;">Subwoofers</a><a href="https://www.ebay.com/str/theelectronicsclearinghouse/_i.html?store_cat=48882158018" style="display:inline-block;width:152px;margin:0 6px 6px 0;padding:12px 10px;background:#F4F5F1;border-left:3px solid #1E45D8;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#14181D;text-decoration:none;vertical-align:top;">Processors, Amps &amp; Receivers</a><a href="https://www.ebay.com/str/theelectronicsclearinghouse/_i.html?store_cat=48882157018" style="display:inline-block;width:152px;margin:0 6px 6px 0;padding:12px 10px;background:#F4F5F1;border-left:3px solid #1E45D8;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#14181D;text-decoration:none;vertical-align:top;">Streamers &amp; Sources</a><a href="https://www.ebay.com/str/theelectronicsclearinghouse/_i.html?store_cat=48882156018" style="display:inline-block;width:152px;margin:0 6px 6px 0;padding:12px 10px;background:#F4F5F1;border-left:3px solid #1E45D8;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#14181D;text-decoration:none;vertical-align:top;">Control &amp; Networking</a><a href="https://www.ebay.com/str/theelectronicsclearinghouse/_i.html?store_cat=48882155018" style="display:inline-block;width:152px;margin:0 6px 6px 0;padding:12px 10px;background:#F4F5F1;border-left:3px solid #1E45D8;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#14181D;text-decoration:none;vertical-align:top;">Cables &amp; Terminations</a><a href="https://www.ebay.com/str/theelectronicsclearinghouse/_i.html?store_cat=48882159018" style="display:inline-block;width:152px;margin:0 6px 6px 0;padding:12px 10px;background:#F4F5F1;border-left:3px solid #1E45D8;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#14181D;text-decoration:none;vertical-align:top;">Car Audio</a>
  </div>

  
  <h2 style="margin:0 0 12px;padding:0 0 8px;border-bottom:2px solid #14181D;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#14181D;">About us</h2>
  <p style="margin:0 0 14px;font-size:15.5px;line-height:1.6;">Enthusiasm, passion and delivery were trademarks of The Electronics Clearing House long before it was founded in 2006. We didn't set out to never be outdone, or to offer the lowest price. We set out to provide the right balance of performance, quality and value.</p>
  <p style="margin:0 0 14px;font-size:15.5px;line-height:1.6;">Our process isn't about maximising what you spend. It's about getting you the solution you actually need and being a good steward of your money &mdash; with the outcome that you're satisfied.</p>
  <p style="margin:0 0 28px;font-size:15.5px;line-height:1.6;">As a custom-installation dealer, our inventory comes through authorized distribution, ECH-owned stock, showroom demo or overstock. We describe the condition, box contents and fulfillment for each listing individually so you know what you are buying.</p>

  
  <h2 style="margin:0 0 16px;padding:0 0 8px;border-bottom:2px solid #14181D;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#14181D;">What our customers say</h2>

  <div style="margin:0 0 12px;padding:16px 18px;background:#F7F8F5;border-left:3px solid #9C7B34;">
    <p style="margin:0 0 10px;font-size:15px;line-height:1.55;font-style:italic;">&ldquo;Best seller on eBay for this stuff. Always responds and gets the product sent right away. Brand new and as described. Thank you sir!&rdquo;</p>
    <p style="margin:0;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6B727A;"><span style="color:#9C7B34;letter-spacing:2px;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> &nbsp;Buyer 1***r (24)</p>
  </div>

  <div style="margin:0 0 12px;padding:16px 18px;background:#F7F8F5;border-left:3px solid #9C7B34;">
    <p style="margin:0 0 10px;font-size:15px;line-height:1.55;font-style:italic;">&ldquo;Excellent seller. Item arrived quickly and I was notified instantly when it was delivered. Item is brand new and in pristine factory condition.&rdquo;</p>
    <p style="margin:0;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6B727A;"><span style="color:#9C7B34;letter-spacing:2px;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> &nbsp;Buyer a***r (16)</p>
  </div>

  <div style="margin:0 0 16px;padding:16px 18px;background:#F7F8F5;border-left:3px solid #9C7B34;">
    <p style="margin:0 0 10px;font-size:15px;line-height:1.55;font-style:italic;">&ldquo;Great experience with The Electronics Clearing House. Items came in new box and seller was communicating with me throughout the whole process.&rdquo;</p>
    <p style="margin:0;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6B727A;"><span style="color:#9C7B34;letter-spacing:2px;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> &nbsp;Buyer a***u (2)</p>
  </div>

  <p style="margin:0 0 30px;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;"><a href="https://www.ebay.com/fdbk/feedback_profile/theelectronicsclearinghouse" style="color:#1E45D8;text-decoration:none;font-weight:bold;">Read all feedback &rarr;</a></p>

  
  <h2 style="margin:0 0 12px;padding:0 0 8px;border-bottom:2px solid #14181D;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#14181D;">Payment</h2>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">All major credit and debit cards, plus every payment method eBay offers at checkout. Message us if you need anything clarified before buying.</p>

  <h2 style="margin:0 0 12px;padding:0 0 8px;border-bottom:2px solid #14181D;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#14181D;">Returns</h2>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>30 days, no restocking fee.</strong> If it isn't right, send it back. That applies to used and dealer-demo stock the same as sealed &mdash; we grade honestly up front so there are no surprises.</p>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">If anything is wrong with your order, message us before opening a case. We will sort it out.</p>

  <h2 style="margin:0 0 12px;padding:0 0 8px;border-bottom:2px solid #14181D;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#14181D;">Shipping</h2>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>Shipping cost, method and handling time are shown in this eBay listing.</strong> Oversized pieces &mdash; large subwoofers and similar &mdash; may be pickup only, and the listing will say so clearly.</p>
  <p style="margin:0 0 26px;font-size:15px;line-height:1.6;">Tracking is provided for shipped orders. Weather and carrier delays are outside our control, but we will keep you informed.</p>

  
  <div style="margin:0;padding:20px 20px 24px;background:#14181D;color:#EDEEEA;">
    <h3 style="margin:0 0 10px;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:#8E959E;">Questions</h3>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#C6CBD1;">Answered within 4 hours during business hours. Ask before you buy &mdash; we would rather talk you into the right part than take a return.</p>
  </div>

  <p style="margin:16px 0 0;text-align:center;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:10px;letter-spacing:2.8px;text-transform:uppercase;color:#8A9098;">ECH &middot; The Electronics Clearing House LLC</p>`;

  function h2(t){
    return '\n  <h2 style="margin:0 0 12px;padding:0 0 8px;border-bottom:2px solid #14181D;font-family:'+F_HEAD+
           ';font-weight:bold;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#14181D;">'+esc(t)+'</h2>';
  }

  function legacyBuild(s){
    var c = CONDS[s.cond], o = [];

    o.push('<div style="width:96%;max-width:1080px;margin:0 auto;padding:22px 18px 24px;background-color:#ffffff;font-family:'+F_BODY+
           ';font-size:16px;line-height:1.6;color:#14181D;">');

    o.push('\n  <div style="margin:0 0 20px;">');
    o.push('<span style="display:inline-block;background:'+c.tagBg+';color:#ffffff;font-family:'+F_MONO+
           ';font-weight:bold;font-size:13px;letter-spacing:1.2px;padding:9px 12px;vertical-align:middle;">'+s.cond+'</span>');
    o.push('<span style="display:inline-block;border:2px solid '+c.border+';border-left:0;color:'+c.text+
           ';font-family:'+F_HEAD+';font-weight:bold;font-size:12px;letter-spacing:1.3px;text-transform:uppercase;padding:8px 15px;vertical-align:middle;">'+
           esc(c.label)+'</span></div>');

    o.push('\n  <h1 style="margin:0 0 10px;font-family:'+F_HEAD+
           ';font-weight:bold;font-size:22px;line-height:1.25;letter-spacing:0.5px;color:#14181D;">'+esc(s.title)+'</h1>');

    if(s.part || s.sold){
      o.push('\n  <p style="margin:0 0 16px;font-family:'+F_MONO+
             ';font-size:13px;letter-spacing:0.5px;color:#1E45D8;">'+
             [esc(s.part), esc(s.sold)].filter(Boolean).join(" &middot; ")+'</p>');
    }

    if(s.hook) o.push('\n  <p style="margin:0 0 26px;font-size:16px;line-height:1.55;">'+esc(s.hook)+'</p>');

    if(s.box.length){
      o.push(h2("In the box"));
      o.push('\n  <ul style="margin:0 0 26px;padding:0;list-style:none;">');
      s.box.forEach(function(t){
        o.push('\n    <li style="margin:0;padding:5px 0;font-size:15px;line-height:1.5;">'+
               '<span style="color:#1E45D8;font-weight:bold;padding-right:9px;">&#10003;</span>'+esc(t)+'</li>');
      });
      o.push('\n  </ul>');
    }

    if(s.spec.length || s.sold){
      o.push(h2("Specification"));
      o.push('\n  <table style="width:100%;border-collapse:collapse;margin:0 0 26px;">');
      var rows = s.spec.slice();
      if(s.mounting) rows.push(["Mounting", s.mounting]);
      if(s.sold) rows.push(["Sold as", s.sold]);
      rows.forEach(function(r, i){
        var last = i === rows.length - 1;
        var bb = last ? "" : "border-bottom:1px solid #E4E5E0;";
        o.push('\n    <tr>');
        o.push('\n      <td style="padding:9px 0;'+bb+'font-size:14px;color:#6B727A;'+
               (i===0?'width:44%;':'')+'">'+esc(r[0])+'</td>');
        o.push('\n      <td style="padding:9px 0;'+bb+'font-family:'+F_MONO+
               ';font-size:13px;text-align:right;">'+esc(r[1])+'</td>');
        o.push('\n    </tr>');
      });
      o.push('\n  </table>');
    }

    if(s.pdesc){
      o.push(h2("About this product"));
      s.pdesc.split(/\n\s*\n/).forEach(function(para){
        var t = para.trim();
        if(t) o.push('\n  <p style="margin:0 0 14px;font-size:15.5px;line-height:1.6;">'+esc(t)+'</p>');
      });
      o[o.length-1] = o[o.length-1].replace('margin:0 0 14px','margin:0 0 26px');
    }

    if(s.ver.length){
      o.push(h2("What we verified"));
      o.push('\n  <ul style="margin:0 0 26px;padding:0;list-style:none;">');
      s.ver.forEach(function(t, i){
        o.push('\n    <li style="margin:'+(i?'6px 0 0':'0')+
               ';padding:5px 0 5px 14px;font-size:15px;line-height:1.5;border-left:3px solid #1E45D8;">'+esc(t)+'</li>');
      });
      o.push('\n  </ul>');
    }

    o.push('\n  ' + TAIL);

    o.push('\n</div>');
    return o.join("");
  }

  // October 4 approved master, ported from description() in build_store_master_previews.py.
  // Only this item's supplied facts are rendered; no blanket seal, warranty or return claims.
  function build(s){
    var section=function(t,b){return '<section style="padding:22px 5%;"><h2 style="margin:0 0 14px;padding-bottom:9px;border-bottom:3px solid #d7a72d;color:#071b33;font-size:22px;">'+esc(t)+'</h2>'+b+'</section>';};
    var condition={N1:'New and unused. Packaging may have been opened only for photography; this does not mean the item has been used.',O2:'Used equipment.',D3:'Dealer-demo equipment.'}[s.cond]||'Condition requires Lee’s review.';
    var verified=(s.ver||[]).filter(Boolean);
    var contents='<ul style="padding-left:22px;">'+(s.box||[]).filter(Boolean).map(function(v){return '<li style="margin:7px 0;">'+esc(v)+'</li>';}).join('')+'</ul>';
    var warning=s.isPassive===true?'Passive speaker: an external amplifier or receiver is required. Confirm the sale unit and included items before purchase.':'Confirm the exact model, sale unit and listed contents before purchase. Only the items listed as included are supplied.';
    var compatibility=s.compatibilityNote||'Check compatibility with your equipment and installation before purchase. Ask us if anything is unclear.';
    var fulfillment={ech:'Ships from Electronics Clearing House owned inventory.',distributor:'Ships through authorized distribution.',pickup:'Local pickup only.'}[s.fulfillment]||'See this eBay listing for fulfillment details.';
    var rows=(s.spec||[]).slice();if(s.mounting)rows.push(['Mounting',s.mounting]);rows.push(['Sale unit',s.sold||'Requires review']);
    var cards=[[s.brand,'BRAND'],[s.part,'EXACT MODEL'],[s.sold,'WHAT YOU RECEIVE']].map(function(r){return '<div style="flex:1 1 180px;background:#071b33;border-bottom:5px solid #d7a72d;padding:18px 12px;text-align:center;box-sizing:border-box;"><strong style="display:block;color:#f1cd70;font-size:20px;overflow-wrap:anywhere;">'+esc(r[0])+'</strong><span style="color:white;font-size:12px;">'+r[1]+'</span></div>';}).join('');
    var specifications='<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;">'+rows.filter(function(r){return r[0]&&r[1];}).map(function(r){return '<tr><th scope="row" style="width:34%;text-align:left;vertical-align:top;background:#edf2f6;padding:12px;border:1px solid #d6dee7;overflow-wrap:anywhere;">'+esc(r[0])+'</th><td style="padding:12px;border:1px solid #d6dee7;overflow-wrap:anywhere;">'+esc(r[1])+'</td></tr>';}).join('')+'</table>';
    return '<div style="margin:0;padding:16px 0;background:#edf1f5;color:#17263a;font-family:Arial,Helvetica,sans-serif;line-height:1.55;"><div style="width:96%;max-width:1080px;margin:auto;background:white;border:1px solid #ccd5df;box-shadow:0 5px 18px #071b3324;"><div style="height:7px;background:#d7a72d;"></div><header style="background:#071b33;padding:24px 5%;text-align:center;"><img src="https://theinstallspot.github.io/ech-listing-studio/masthead.png" alt="Electronics Clearing House" style="display:block;width:760px;max-width:100%;height:auto;margin:auto;"><p style="color:#f1cd70;font-size:12px;letter-spacing:1.3px;margin-bottom:0;">CLEAR DETAILS • HONEST CONDITION • REAL ECH SUPPORT</p></header><div style="background:#f8fafc;padding:28px 5%;border-bottom:1px solid #dbe2ea;"><span style="display:inline-block;background:#d7a72d;color:#071b33;padding:7px 12px;font-size:13px;font-weight:bold;">'+esc(s.cond)+' · '+esc(CONDS[s.cond]?CONDS[s.cond].label:'Review needed')+'</span><h1 style="font-size:28px;line-height:1.22;color:#071b33;overflow-wrap:anywhere;">'+esc(s.title)+'</h1>'+(s.hook?'<p style="margin-bottom:0;">'+esc(s.hook)+'</p>':'')+'</div><div style="display:flex;flex-wrap:wrap;gap:10px;padding:26px 5% 4px;">'+cards+'</div>'+section('Condition','<p>'+esc(condition)+'</p>'+verified.map(function(v){return '<p>'+esc(v)+'</p>';}).join(''))+section('What is included',contents)+'<aside style="margin:6px 5% 14px;padding:20px;background:#fff7df;border-left:6px solid #d7a72d;"><strong style="color:#071b33;">'+esc(warning)+'</strong></aside>'+section('Technical specifications',specifications)+section('Before you buy','<p>'+esc(compatibility)+'</p>'+(s.pdesc?'<p>'+esc(s.pdesc)+'</p>':''))+section('Shipping and returns','<p>'+esc(fulfillment)+'</p><p>'+esc(s.shippingPlan||'Shipping cost, handling time, service and delivery estimates are shown in this eBay listing.')+'</p><p>Please review the return terms displayed in this eBay listing before purchase.</p>')+'<div style="margin:24px 5%;padding:24px;background:#0e3159;color:white;border-left:7px solid #d7a72d;"><span style="color:#f1cd70;font-size:12px;letter-spacing:1px;">THE ECH DIFFERENCE</span><h2 style="margin:7px 0;font-size:23px;">Equipment for real installation projects</h2><p>Electronics Clearing House offers home audio, video, networking and smart-home equipment. Clear model identification, honest condition and explicit package contents help you choose the right gear.</p><a style="color:#f1cd70;font-weight:bold;" href="https://www.ebay.com/str/theelectronicsclearinghouse">Shop the ECH store</a> • <a style="color:#f1cd70;" href="https://www.ebay.com/fdbk/feedback_profile/theelectronicsclearinghouse">View our feedback</a></div><footer style="background:#071b33;color:white;text-align:center;padding:22px 5%;border-top:5px solid #d7a72d;"><strong style="color:#f1cd70;">Questions about fit or compatibility?</strong><br>Send us an eBay message before purchase.</footer></div></div>';
  }

  function ebayTitle(s){
    var condition={N1:"New",O2:"Used",D3:"Dealer Demo"}[s.cond]||"";
    var what=String(s.what||"").replace(/(\d+(?:\.\d+)?)-inch\b/gi,"$1 in");
    return [s.brand,s.part,what,condition,s.sold,s.cond?"("+s.cond+")":""].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
  }

  function problems(s){
    var p = [];
    if(!s.title) p.push("headline");
    if(!s.part)  p.push("part number");
    // Marketing copy is prepared by Lee's workflow, not required from Paige.
    if(!s.sold)  p.push("sold as");
    else if(!/^(Each|Pair of 2|Set of \d+|\d+-Pack)$/i.test(String(s.sold).trim())) p.push("valid sale unit");
    if(!s.box.length) p.push("at least one box item");
    if(!s.ver.length) p.push("at least one verified line");
    return p;
  }

  // ---------------- render
  
if (typeof module !== "undefined") { module.exports = { build, ebayTitle, problems, esc, CONDS }; }
if (typeof window !== "undefined") { window.ECHCore = { build, ebayTitle, problems, esc, CONDS }; }
