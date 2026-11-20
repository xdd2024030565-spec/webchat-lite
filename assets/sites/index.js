/* ============================================================
   站点注册表 + 顺序加载器
   加一个站：新建 assets/sites/<id>.js（push 一份 def），再把 id 加进下面的 IDS。
   index.html 与 app.js 都不用改。
   ============================================================ */
(function (root) {
  'use strict';

  var IDS = ['deepseek', 'grok'];
  root.WCL_SITE_IDS = IDS;
  root.WCL_SITE_DEFS = root.WCL_SITE_DEFS || [];

  var WCL = root.WCL = root.WCL || {};
  WCL.sites = WCL.sites || {};

  WCL.sites.load = function (cb) {
    var i = 0;
    function step() {
      if (i >= IDS.length) {
        if (cb) cb(root.WCL_SITE_DEFS || []);
        return;
      }
      var id = IDS[i];
      var s = document.createElement('script');
      s.async = false;
      s.src = 'assets/sites/' + id + '.js';
      s.onload = function () { i++; step(); };
      s.onerror = function () { i++; step(); };
      (document.head || document.getElementsByTagName('head')[0]).appendChild(s);
    }
    step();
  };

  // 兼容：脚本按顺序内联插入时（同域、非 defer）也会立即拿到 defs
  WCL.sites.defs = function () { return root.WCL_SITE_DEFS || []; };
})(typeof window !== 'undefined' ? window : this);
