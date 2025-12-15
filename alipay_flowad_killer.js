/**
 * Alipay MiniProgram FlowAd Killer
 * Mode: ALL（信息流 / 会场 / 任务型）
 */

(function () {
  try {
    function remove(el) {
      if (!el) return;
      el.style.display = 'none';
      el.style.height = '0';
      el.style.margin = '0';
      el.style.padding = '0';
      el.remove();
    }

    // 信息流广告
    function killFeed() {
      document.querySelectorAll('[resourceid],[data-resource-id]').forEach(el => {
        const txt = el.innerText || '';
        const imgs = el.querySelectorAll('img').length;
        if (imgs >= 2 && /(¥|\$|券|到手|优惠)/.test(txt)) {
          remove(el);
        }
      });
    }

    // 会场 icon
    function killHall() {
      document.querySelectorAll('img').forEach(img => {
        const box = img.parentElement;
        const txt = box?.innerText || '';
        if (/(会场|精选|秒杀|9\.9|活动|专场)/.test(txt)) {
          remove(box);
        }
      });
    }

    // 任务型广告
    function killTask() {
      document.querySelectorAll('*').forEach(el => {
        const txt = el.innerText || '';
        if (/(任务|奖励|去完成|领取|已完成)/.test(txt) && el.offsetHeight < 320) {
          remove(el);
        }
      });
    }

    function run() {
      killFeed();
      killHall();
      killTask();
    }

    run();
    setInterval(run, 600);
  } catch (e) {}
})();
