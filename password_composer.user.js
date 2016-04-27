// ==UserScript==
// @name          Password Composer
// @namespace     http://joe.lapoutre.com/BoT/Javascript/
// @description   Generate site specific password based on a single Master Password.
// @include       *
// @exclude
// @resource      pwdfieldbg    img/pwdfieldbg.png
// @resource      icnShow       img/icnShow.png
// @resource      icnHide       img/icnHide.png
// @resource      icnPlus       img/icnPlus.png
// @resource      icnMin        img/icnMin.png
// @resource      domains       http://www.surbl.org/static/two-level-tlds
// @grant         GM_getResourceText
// @grant         GM_getResourceURL
// @grant         GM_getValue
// @grant         GM_setValue
// @version       3.0
// @downloadURL   https://raw.githubusercontent.com/lkraider/password-composer/master/password_composer.user.js
// ==/UserScript==

// begin user script

var pwdc = {
    prefs: {
        clearText: false,  // show generated passwds in cleartext
        topDomain: false   // use top domain instead of full host
    },

    // VARS
    tmr: null, // timeout timer
    lastPwdField: null,

    // METHODS
    addOpener: function(fld) {
        var cls = fld.getAttribute("class");
        // return if class name (and dblclick handler) was set already
        if (cls && cls.indexOf("mpwdpasswd") > -1) return;
        fld.style.background = "#dfd url(" + this.icons.pwdfieldbg + ")";
        fld.style.backgroundPosition = "top right";
        fld.style.backgroundRepeat = "no-repeat";
        fld.style.borderColor = "green";
        fld.style.borderStyle = "inset";
        pwdc.addEventListener(fld, 'dblclick', pwdc.addPanel, true);
        fld.title = "Double click to open Password Composer";
        fld.setAttribute("class", (cls) ? cls + " mpwdpasswd" : "mpwdpasswd");
    },

    initFlds: function(doc) {
        var L = {};
        try {
            L = doc.getElementsByTagName('input');
        } catch (e) {
            dbg( doc + ", " + e.message);
        }
        var flds = [];
        for (var i=0; i < L.length; i++) {
            var nm, tp, cl;
            try { nm = L[i].getAttribute("name") || ""; } catch(e) { }
            try { tp = L[i].getAttribute("type") || ""; } catch(e) { }
            try { cl = L[i].getAttribute("class") || ""; } catch(e) { }
            if ((tp.toLowerCase() == "password") ||
                (tp == "text" && nm.toLowerCase().substring(0,5) == "passw") ||
                (cl.indexOf("mpwdpasswd") > -1)) {
                    pwdc.addOpener(L[i]);
            }
        }
    },

    // init fields after a short tmeout
    initFldsSoon: function() {
        if (pwdc.tmr) clearTimeout(pwdc.tmr);
        pwdc.tmr = setTimeout(function() { pwdc.initFlds(document); }, 100);
    },

    // cross browser event listeners
    addEventListener: function(obj, evtName, func, capture) {
        if (obj.addEventListener) {
            obj.addEventListener(evtName, func, capture);
            return true;
        } else if (obj.attachEvent) return obj.attachEvent("on"+evtName, func);
    },

    removeEventListener: function(obj, evtName, func, capture) {
        if (obj.removeEventListener) {
            obj.removeEventListener(evtName, func, capture);
            return true;
        } else if (obj.detachEvent) return obj.detachEvent("on"+evtName, func);
    },

    getHostname: function() {
        var re = new RegExp('https?://([^/]+)');
        var url = document.location.href.toLowerCase();
        var host = null;
        try {
            host = url.match(re)[1];
        } catch (e) {
            // e.g.  working on a local file makes no sense
            return "INVALID DOMAIN";
        }
        // look at minimum domain instead of host
        // see http://labs.zarate.org/passwd/
        if (pwdc.prefs.topDomain) {
            host = host.split('.');
            if (host[2] !== null) {
                s = host[host.length-2] + '.' + host[host.length-1];
                const domains = new Set(GM_getResourceText("domains").split('\n'));
                if (domains.has(s)) {
                    s = host[host.length-3] + '.' + s;
                }
            } else {
                s = host.join('.');
            }
            return s;
        } else {
            // no manipulation (full host name)
            return host;
        }
    },

    // Setting: use sub domain
    initSubdomainSetting: function() {
        if (typeof(GM_getValue) == 'function') {
            pwdc.prefs.topDomain = GM_getValue('topDomain', false);
        }
        pwdc.updateSubDomainSetting();
    },

    toggleSubdomain: function(val) {
        if (typeof(val) == 'boolean') {
            // use provided argument {true, false}...
            pwdc.prefs.topDomain = val;
        } else {
            // ...or toggle current value.
            pwdc.prefs.topDomain = !pwdc.prefs.topDomain;
        }
        if (typeof(GM_setValue) == 'function') {
            GM_setValue('topDomain', pwdc.prefs.topDomain);
        }
        pwdc.updateSubDomainSetting();
        document.getElementById('masterpwd').focus();
    },

    updateSubDomainSetting: function() {
        var icn = document.getElementById("icnSubdom");
        if (pwdc.prefs.topDomain) {
            icn.setAttribute('src', pwdc.icons.icnPlus);
            icn.setAttribute('title', "Using host's top level domain name");
        } else {
            icn.setAttribute('src', pwdc.icons.icnMin);
            icn.setAttribute('title', "Using full host name");
        }
        document.getElementById("mpwddomain").setAttribute('value',
            pwdc.getHostname());
    },

    toggleClearText: function(val) {
        if (typeof(val) == 'boolean') {
            // use provided argument {true, false}...
            pwdc.prefs.clearText = val;
        } else {
            // ...or toggle current value.
            pwdc.prefs.clearText = !pwdc.prefs.clearText;
        }
        var icn = document.getElementById("icnShow");
        icn.setAttribute('src', (pwdc.prefs.clearText) ?
            pwdc.icons.icnShow : pwdc.icons.icnHide);
        document.getElementById('masterpwd').focus();
    },

    // verify if both passwords match (if two fields are displayed)
    checkPassword: function() {
        var pwd = document.getElementById('masterpwd');
        var pwd2 = document.getElementById('secondpwd');
        if (!pwd2) return true;
        if (pwd.value !== pwd2.value && pwd2.value !== '') {
            pwd2.style.background='#f77';
            pwd2.style.borderColor='red';
            return false;
        } else {
            pwd2.style.background = 'white';
            pwd2.style.borderColor='#777';
            return true;
        }
    },

    keyup: function(e) {
        pwdc.checkPassword();
        // CR, LF
        if (e.keyCode == 13 || e.keyCode == 10) {
            pwdc.generatePassword();
        // ESC
        } else if (e.keyCode == 27) {
            pwdc.removePanel();
        // SHIFT-CTRL-LEFT-ARROW
        } else if (e.keyCode == 37 && e.ctrlKey && e.shiftKey) {
            pwdc.toggleSubdomain(true);
        // SHIFT-CTRL-RIGHT-ARROW
        } else if (e.keyCode == 39 && e.ctrlKey && e.shiftKey) {
            pwdc.toggleSubdomain(false);
        // SHIFT-CTRL-C
        } else if (e.keyCode == 67 && e.ctrlKey && e.shiftKey) {
            pwdc.toggleClearText();
        }
        return true;
    },

    cancelEvent: function(e) {
        if (e.stopPropagation) e.stopPropagation();
        return false;
    },

    // generate the password and populate original form
    generatePassword: function() {
        if (!pwdc.checkPassword()) {
            return;
        }
        var master = document.getElementById('masterpwd').value;
        var domain = document.getElementById('mpwddomain').value.toLowerCase();
        var pass = hex_md5(master+':'+domain).substr(0,8);
        // show password in pwdcomposer rather than inserting into host page
        var generatedpwd = document.getElementById('generatedpwd');
        if (generatedpwd) {
            generatedpwd.value = pass;
            return;
        }
        // remove panel before messing with passwd fields in host page
        pwdc.removePanel();
        if (master !== '' && master !== null) {
            var i=0, j=0;
            var inputs = document.getElementsByTagName('input');
            for(i=0; i<inputs.length; i++) {
                var inp = inputs[i];
                var cl = inp.getAttribute("class") || "";
                // every passwd field is set to class "mpwdpasswd" on initialization
                if (cl.indexOf("mpwdpasswd") != -1) {
                    inp.value = pass;
                    try {
                        inp.type = (pwdc.prefs.clearText) ? "text" : "password";
                    } catch (e) {}
                }
            }
            // give focus to selected passwd field
            if (pwdc.lastPwdField) pwdc.lastPwdField.focus();
        }
    },

    // check for multiple passwd fields per form (e.g. 'verify passwd')
    hasMultiplePwdFields: function() {
        // find any form that has 2+ password fields as children
        // note literal '>' char in xpath expression!
        var multiple = true; // default: show check field
        try {
            var xpres = document.evaluate("count(//form[count(//input[@type='password']) > 1])",
            document, null, XPathResult.ANY_TYPE,null);
            multiple = (xpres.numberValue > 0);
        } catch (e) {
        }
        return multiple;
    },

    removePanel: function() {
        var body = document.getElementsByTagName('body')[0];
        body.removeChild(document.getElementById('mpwd_bgd'));
        body.removeChild(document.getElementById('mpwd_panel'));
        // remove masking key up/down event handlers
        pwdc.removeEventListener(document, 'keydown', pwdc.cancelEvent, false);
        pwdc.removeEventListener(document, 'keyup', pwdc.cancelEvent, false);
    },

    addPanel: function(evt) {
        evt = (evt) ? evt : window.event;
        var pwdTop = 0;
        var pwdLeft = 0;
        if (evt) {
            var elem = (evt.target) ? evt.target : evt.srcElement;
            // element nodes only
            if (1 == elem.nodeType) {
                var fld = pwdc.lastPwdField = elem;
                // open pwd panel aligned with double-clicked field
                while (fld.offsetParent) {
                    pwdTop += fld.offsetTop;
                    pwdLeft += fld.offsetLeft;
                    fld = fld.offsetParent;
                }
                // shift panel to fully cover orig. passwd field
                pwdTop -= 5;
                pwdLeft -= 5;
            }
        } else {
            pwdc.lastPwdField = null;
        }
        // temporarily mask original key up/down handlers
        pwdc.addEventListener(document, 'keydown',  pwdc.cancelEvent, false);
        pwdc.addEventListener(document, 'keyup',  pwdc.cancelEvent, false);
        if (document.getElementById('mpwd_panel')) {
            pwdc.removePanel();
            return;
        }
        var pwdFound = (pwdc.lastPwdField !== null);

        // full document width and height as rendered in browser:
        // reverting to non-standard properties below
        var pag_w = document.documentElement.scrollWidth;
        var pag_h = document.documentElement.scrollHeight;
        if (window.innerHeight > pag_h) pag_h = window.innerHeight;

        var div = document.createElement('div');
        div.style.color='#777';
        div.style.padding='5px';
        div.style.backgroundColor='white';
        div.style.border='1px solid black';
        div.style.borderBottom='3px solid black';
        div.style.borderRight='2px solid black';
        div.style.MozBorderRadius='10px';
        div.style.fontSize='9pt';
        div.style.fontFamily='sans-serif';
        div.style.lineHeight='1.8em';
        div.style.position='absolute';
        div.style.width='230px';
        // keep panel at least 10 px away from right page edge
        div.style.left = ((250 + pwdLeft > pag_w) ? pag_w - 250 : pwdLeft) + 'px';
        div.style.top = pwdTop + 'px';
        div.style.zIndex = '2147483647';  // make sure we're visible/on top
        div.setAttribute('id', 'mpwd_panel');
        div.appendChild(document.createTextNode('Master password: '));

        var show = document.createElement('img');
        show.setAttribute('src', (pwdc.prefs.clearText) ?
            pwdc.icons.icnShow : pwdc.icons.icnHide);
        show.style.width = "12px";
        show.style.height = "12px";
        show.setAttribute('id', "icnShow");
        show.setAttribute('title', 'Show or hide generated password Shift+Ctrl+C');
        show.style.paddingRight = '4px';
        show.style.display = 'inline'; // some stupid sites set this to block
        show.style.cursor = 'pointer';
        show.style.border = 'none';
        pwdc.addEventListener(show, 'click', pwdc.toggleClearText, true);
        div.appendChild(show);

        var pwd = document.createElement('input');
        pwd.style.border='1px solid #777';
        pwd.setAttribute('type','password');
        pwd.setAttribute('id','masterpwd');
        pwd.setAttribute("class", "mpwdpasswd");
        // specify tabindex, otherwise an existing 'tabindex=2' on host page takes precedence
        pwd.setAttribute('tabindex',10000);
        pwd.style.width = '100px';
        pwd.style.fontSize='9pt';
        pwd.style.color='#777';
        pwd.style.backgroundColor='white';
        if (! pwdFound) pwdc.addEventListener(pwd, 'change', pwdc.generatePassword, true);
        div.appendChild(pwd);
        div.appendChild(document.createElement('br'));

        if (pwdc.hasMultiplePwdFields() || ! pwdFound) {
            // only if a 'verify field' is on original page
            div.appendChild(document.createTextNode('Check password: '));
            var pwd2 = document.createElement('input');
            pwd2.setAttribute('type','password');
            pwd2.setAttribute('id','secondpwd');
            pwd2.setAttribute("class", "mpwdpasswd");
            pwd2.setAttribute('tabindex',10001);
            pwd2.style.width = '100px';
            pwd2.style.color='#777';
            pwd2.style.backgroundColor='white';
            pwd2.style.border='1px solid #777';
            pwd2.style.fontSize='9pt';
            if (! pwdFound) pwdc.addEventListener(pwd2, 'change', pwdc.generatePassword, true);
            div.appendChild(pwd2);
            div.appendChild(document.createElement('br'));
        }

        div.appendChild(document.createTextNode('Domain: '));

        var subicn = document.createElement('img');
        subicn.setAttribute('src', pwdc.icons.icnPlus);
        subicn.style.width = "9px";
        subicn.style.height = "9px";
        subicn.style.marginRight = "5px";
        subicn.setAttribute('id', "icnSubdom");
        subicn.setAttribute('title', 'Using full host name');
        subicn.style.display='inline';
        subicn.style.cursor = 'pointer';
        subicn.style.border = 'none';
        pwdc.addEventListener(subicn,'click', function(event) {
            pwdc.toggleSubdomain();
            document.getElementById('masterpwd').focus();
        }, true);
        div.appendChild(subicn);

        var domn = document.createElement('input');
        domn.setAttribute('type','text');
        domn.setAttribute('value', pwdc.getHostname());
        domn.setAttribute('id','mpwddomain');
        domn.setAttribute('tabindex',10002);
        domn.setAttribute('title','Edit domain name for different password');
        domn.style.width = '150px';
        domn.style.border = 'none';
        domn.style.fontSize = '9pt';
        domn.style.color = '#777';
        domn.style.backgroundColor = 'white';
        if (! pwdFound) pwdc.addEventListener(domn, 'change', pwdc.generatePassword, true);
        div.appendChild(domn);

        if (! pwdFound) {
            // show generated password if no password field found on host page
            div.appendChild(document.createTextNode('Generated pwd: '));
            var pwd3 = document.createElement('input');
            pwd3.setAttribute('type','text');
            pwd3.setAttribute('id','generatedpwd');
            pwd3.setAttribute('tabindex',10004);
            pwd3.style.width = '100px';
            pwd3.style.color = 'black';
            pwd3.style.backgroundColor = 'white';
            pwd3.style.border = '1px solid #777';
            pwd3.style.fontSize = '9pt';
            pwdc.addEventListener(pwd3, 'focus', function(evt) {
                    evt = (evt) ? evt : window.event;
                    pwdc.generatePassword();
                    var elem = (evt.target) ? evt.target : evt.srcElement;
                    elem.select();
                }, true);
            div.appendChild(pwd3);
            div.appendChild(document.createElement('br'));
        }

        pwdc.addEventListener(div, "keyup", pwdc.keyup, false);
        pwdc.addEventListener(div, "keydown", pwdc.cancelEvent, false);

        var bgd = document.createElement('div');
        bgd.setAttribute('id','mpwd_bgd');
        bgd.style.position='absolute';
        bgd.style.top='0px';
        bgd.style.left='0px';
        bgd.style.backgroundColor='black';
        bgd.style.opacity='0.4';
        bgd.style.height = pag_h + 'px';
        bgd.style.width = pag_w + 'px';
        bgd.style.zIndex = '2147483646';
        pwdc.addEventListener(bgd, 'click', pwdc.removePanel, true);

        var body = document.getElementsByTagName('body')[0];
        body.appendChild(bgd);
        body.appendChild(div);
        try { pwd.focus(); } catch(e) {}
        setTimeout(function() { pwd.focus(); }, 250);
        pwdc.initSubdomainSetting();
    },

    icons: {
        // background icon for passwd field 12x14px
        pwdfieldbg: GM_getResourceURL("pwdfieldbg"),
        // show in cleartext
        icnShow: GM_getResourceURL("icnShow"),
        // hide passwd (show as *****)
        icnHide: GM_getResourceURL("icnHide"),
        // plus sign (use full host name)
        icnPlus: GM_getResourceURL("icnPlus"),
        // minus sign (use top level domain name)
        icnMin: GM_getResourceURL("icnMin")
    },
};


// MD5 stuff
function hex_md5(s) {
    return binl2hex(core_md5(str2binl(s), s.length * 8));
}
function core_md5(x, len) {
    x[len >> 5] |= 0x80 << ((len) % 32);
    x[(((len + 64) >>>9) << 4) + 14] = len;
    var a = 1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d = 271733878;
    for (var i = 0; i < x.length; i += 16) {
        var olda = a;
        var oldb = b;
        var oldc = c;
        var oldd = d;
        a = md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
        d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
        b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);
        a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
        a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);
        a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
        d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
        c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
        d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);
        a = safe_add(a, olda);
        b = safe_add(b, oldb);
        c = safe_add(c, oldc);
        d = safe_add(d, oldd);
    }
    return Array(a, b, c, d);
}
function md5_cmn(q, a, b, x, s, t) {
    return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
}
function md5_ff(a, b, c, d, x, s, t) {
    return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t) {
    return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t) {
    return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t) {
    return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}
function safe_add(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
}
function bit_rol(num, cnt) {
    return (num << cnt) | (num >>>(32 - cnt));
}
function str2binl(str) {
    var bin = Array();
    var mask = (1 << 8) - 1;
    for (var i = 0; i < str.length * 8; i += 8) {
        bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (i % 32);
    }
    return bin;
}
function binl2hex(binarray) {
    var hex_tab = '0123456789abcdef';
    var str = '';
    for (var i = 0; i < binarray.length * 4; i++) {
        str += hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) + hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
    }
    return str;
}
// end MD5 stuff



// INITIALIZE
// change password field style: background image, color
// add double click listener to open panel on current field
pwdc.initFlds(document);

// Ajax: new node listener
pwdc.addEventListener(document, "DOMNodeInserted",
    function(evt) {
        evt = (evt) ? evt : window.event;
        var elem = (evt.target) ? evt.target : evt.srcElement;
        if (1 == elem.nodeType) pwdc.initFlds(elem);
    }, true);
// Ajax: attribute change listener
pwdc.addEventListener(document, "DOMAttrModified",
    function(evt) {
        pwdc.initFldsSoon();
    }, true);

// end user script
