// ==UserScript==
// @name          Password Composer
// @namespace     http://joe.lapoutre.com/BoT/Javascript/
// @description   Generate site specific password, based on a single Master Password.
// @include       *
// @exclude
// @require       md5.js
// @require       sha1.js
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
// @run-at        document-idle
// @version       3.0
// @downloadURL   https://raw.githubusercontent.com/lkraider/password-composer/master/password_composer.user.js
// @license       MIT
// ==/UserScript==

var pwdc = {
    prefs: {
        clearText: false,  // show generated passwds in cleartext
        topDomain: false,  // use top domain instead of full host
        hashMode: 'SHA1_16' // hash and password length selection
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
            console.log(doc + ", " + e.message);
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

    toggleHashMode: function(val) {
        const modes = Array.from(pwdc.modes.keys());
        let i;
        if (typeof(val) === 'number') {
            i = val;
        } else if (typeof(val) === 'string') {
            i = modes.indexOf(val);
        } else {
            const j = modes.indexOf(pwdc.prefs.hashMode);
            i = (j + 1) % modes.length;
        }
        pwdc.prefs.hashMode = modes[i];
        const mode = document.getElementById('pwdc-mode');
        mode.innerText = pwdc.prefs.hashMode.split('_').slice(-1);
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
        var pass = pwdc.modes.get(pwdc.prefs.hashMode)(master, domain);
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
        div.style.width='235px';
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
        {   // Toggle for generated password hashing mode
            const mode = document.createElement('span');
            mode.setAttribute('id','pwdc-mode');
            mode.innerText = pwdc.prefs.hashMode.split('_').slice(-1);
            mode.style.color = '#000';
            mode.style.width = '12px';
            mode.style.height = '12px';
            mode.style.fontSize = '8px';
            mode.style.fontFamily = 'monospace';
            mode.style.marginLeft = '4px';
            mode.style.display = 'inline';
            mode.style.lineHeight = '15px';
            mode.style.verticalAlign = 'top';
            mode.style.cursor = 'pointer';
            pwdc.addEventListener(mode, 'click', pwdc.toggleHashMode, true);
            div.appendChild(mode);
        }
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

        pwdc.addEventListener(div, 'keyup', pwdc.keyup, false);
        pwdc.addEventListener(div, 'keydown', pwdc.cancelEvent, false);

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

    // hash operation modes -> map of names and functions
    // name is stored in preferences
    // text after last `_` in name is displayed in UI
    modes: new Map([
        ['MD5_8', function(master, domain) {
            return hex_md5(master+':'+domain).substr(0,8);
        }],
        ['SHA1_10', function(master, domain) {
            return b64_sha1(master+':'+ domain).substr(0,8) + '1A';
        }],
        ['SHA1_16', function(master, domain) {
            return b64_sha1(master+':'+ domain).substr(0,13) + '@1A';
        }]
    ]),

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

// INITIALIZE
// change password field style: background image, color
// add double click listener to open panel on current field

pwdc.initFlds(document);

var observer = new MutationObserver(function(records) {
    records.forEach(function(record) {
        switch (record.type) {
            case 'childList':
                if (record.target.nodeType === 1) {
                    pwdc.initFlds(record.target);
                }
                break;
            case 'attributes':
                pwdc.initFldsSoon();
                break;
        }
    });
});

observer.observe(document, {childList: true, attributes: true, subtree: true,
    attributeFilter: ['type']});
