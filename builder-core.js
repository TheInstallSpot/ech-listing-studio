/* ECH listing HTML generator — extracted verbatim from ECHlistingbuilder.html */
"use strict";
function esc(s){
    return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ---------------- repeatable rows
  var CONDS = {
    N1:{label:"New \u00b7 Factory sealed", tagBg:"#1839B4", border:"#1839B4", text:"#1839B4"},
    O2:{label:"Open box \u00b7 Complete",  tagBg:"#0F1318", border:"#22282F", text:"#22282F"},
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
  <p style="margin:0 0 28px;font-size:15.5px;line-height:1.6;">As a custom-installation dealer, everything we list comes through authorised distribution, showroom demo or overstock. Every unit is bench-tested and photographed before it goes up. To us this isn't work &mdash; it's what we're passionate about.</p>

  
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
  <p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>30 days, no restocking fee.</strong> If it isn't right, send it back. That applies to open-box and dealer-demo stock the same as sealed &mdash; we grade honestly up front so there are no surprises.</p>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">If anything is wrong with your order, message us before opening a case. We will sort it out.</p>

  <h2 style="margin:0 0 12px;padding:0 0 8px;border-bottom:2px solid #14181D;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#14181D;">Shipping</h2>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>Free shipping on all of our products, excluding local pickup items.</strong> Oversized pieces &mdash; large subwoofers and similar &mdash; are pickup only, and the listing will say so clearly.</p>
  <p style="margin:0 0 26px;font-size:15px;line-height:1.6;">Everything ships tracked and insured, double-boxed, same business day where possible. Weather and carrier delays are outside our control, but we will keep you informed.</p>

  
  <div style="margin:0;padding:20px 20px 24px;background:#14181D;color:#EDEEEA;">
    <h3 style="margin:0 0 10px;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:#8E959E;">Questions</h3>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#C6CBD1;">Answered within 4 hours during business hours. Ask before you buy &mdash; we would rather talk you into the right part than take a return.</p>
  </div>

  <p style="margin:16px 0 0;text-align:center;font-family:Futura,'Century Gothic','Trebuchet MS',Verdana,sans-serif;font-weight:bold;font-size:10px;letter-spacing:2.8px;text-transform:uppercase;color:#8A9098;">ECH &middot; The Electronics Clearing House LLC</p>`;

  function h2(t){
    return '\n  <h2 style="margin:0 0 12px;padding:0 0 8px;border-bottom:2px solid #14181D;font-family:'+F_HEAD+
           ';font-weight:bold;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#14181D;">'+esc(t)+'</h2>';
  }

  function build(s){
    var c = CONDS[s.cond], o = [];

    o.push('<div style="max-width:700px;margin:0 auto;padding:22px 18px 24px;background-color:#ffffff;font-family:'+F_BODY+
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

  function ebayTitle(s){
    return [s.brand, s.part, s.what, s.sold].filter(Boolean).join(" ") + (s.cond ? " ("+s.cond+")" : "");
  }

  function problems(s){
    var p = [];
    if(!s.title) p.push("headline");
    if(!s.part)  p.push("part number");
    if(!s.hook)  p.push("hook");
    if(!s.sold)  p.push("sold as");
    if(!s.box.length) p.push("at least one box item");
    if(!s.ver.length) p.push("at least one verified line");
    return p;
  }

  // ---------------- render
  
if (typeof module !== "undefined") { module.exports = { build, ebayTitle, problems, esc, CONDS }; }
if (typeof window !== "undefined") { window.ECHCore = { build, ebayTitle, problems, esc, CONDS }; }
