// 对数据进行绑定
// DOM 和 数据之间的回调关系
class Watcher {
  constructor(expr, vm, cb) {
    this.expr = expr;
    this.vm = vm;
    this.cb = cb;
    this.oldValue = this.getOldValue();
  }
  getOldValue() {
    Dep.target = this;
    console.log(Dep.target);
    const oldValue = utils.getValue(this.expr, this.vm);
    Dep.target = null; // 设置成功
    return oldValue;
  }
  update() {
    const newValue = utils.getValue(this.expr, this.vm);
    if (newValue != this.oldValue) {
      this.cb(newValue);
    }
  }
}
// 把数据和多个wacther 进行绑定
class Dep {
  constructor() {
    this.collect = [];
  }
  addWatcher(watcher) {
    this.collect.push(watcher);
  }
  notify() {
    this.collect.forEach(w => w.update());
  }
}
// 对不同节点内容进行处理
const utils = {
  getValue(expr, vm) {
    //  可以优化 例如传入的是三目运算符 表达式等等
    return vm.$data[expr];
  },
  setValue(expr, vm, newValue) {
    vm.$data[expr] = newValue;
  },
  model(node, value, vm) {
    const initValue = this.getValue(value, vm);
    console.log(initValue);
    new Watcher(value, vm, newValue => {
      this.modelUpdater(node, newValue);
    });

    node.addEventListener("input", e => {
      const newValue = e.target.value;
      // 设置新的值
      this.setValue(value, vm, newValue);
    });
    this.modelUpdater(node, initValue);
  },
  modelUpdater(node, value) {
    node.value = value;
  },
  text(node, value, vm) {
    // {{ xxx }}
    let result;
    if (value.includes("{{")) {
      result = value.replace(/\{\{(.+)\}\}/g, (...args) => {
        new Watcher(args[1], vm, newVal => {
          this.textUpdater(node, newVal);
        });
        return this.getValue(args[1], vm);
      });
    } else {
      // v-text = 'xxx'
      result = this.getValue(value, vm);
    }
    this.textUpdater(node, result);
  },
  on(node, value, vm, eventName) {
      const fn = vm.$options.methods[value];
      node.addEventListener(eventName,fn.bind(vm),false);

  },
  textUpdater(node, result) {
    node.textContent = result;
  }
};
class Compliler {
  constructor(el, vm) {
    // 判断是否节点
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    // 数据的绑定处理 使用document.fragement 进行回流和重绘优化
    const fragment = this.complieFragement(this.el);
    this.compile(fragment);
    // 更新节点部分
    this.el.appendChild(fragment);
  }
  compile(fragment) {
    const childNodes = Array.from(fragment.childNodes);
    //console.log(childNodes);
    childNodes.forEach(childNode => {
      // 每一个文本节点
      //  console.log(childNode);
      if (this.isElementNode(childNode)) {
        // 标签节点 h1/input 读取属性 看是否有v- 开头的内容
        //console.log("标签节点：",childNode);
        // 处理元素节点
        this.compileElement(childNode);
      } else if (this.isTextNode(childNode)) {
        // 内容文本节点 {{msg}} 是否有双括号语法
        //console.log("文本节点",childNode);
        // 处理文本节点
        this.compileTextNode(childNode);
      }
      // 递归处理子节点
      if (childNode.childNodes && childNode.length) {
        this.compile(childNode);
      }
    });
  }
  compileElement(node) {
    // v-
    const attributes = Array.from(node.attributes);
    attributes.forEach(attr => {
      const { name, value } = attr;
      console.log(name);
      // console.log("attr:",name,value);
      if (this.isDirective(name)) {
        // v-model v-text v-on:click
        const [, directive] = name.split("-");
        const [compileKey, eventName] = directive.split(":");
       // console.log(directive);
        utils[compileKey](node, value, this.vm, eventName);
        //    console.log("compileKey:",compileKey," eventName:",eventName);
      }else if(this.isEventName(name)){
          // @ 开头的方法执行
        const [,eventName] = name.split("@");
        
        utils["on"](node,value,this.vm,eventName);
      }
    });
  }
  // 判断是否 @开头
  isEventName(name){
      return name.startsWith("@");
  }
  // 判断是否为指令
  isDirective(name) {
    return name.startsWith("v-");
  }
  compileTextNode(node) {
    // {{ msg }}
    const content = node.textContent;
    //console.log("content:",content);
    if (/\{\{(.+)\}\}/.test(content)) {
      // console.log("content:",content);
      utils["text"](node, content, this.vm);
    }
  }
  complieFragement(el) {
    const f = document.createDocumentFragment();
    let firstChild;
    // appendChild 每调用一次 会将原 el firstChild 删掉
    while ((firstChild = el.firstChild)) {
      f.appendChild(firstChild);
    }
    // console.log(f);
    return f;
  }
  isTextNode(el) {
    // 文本节点
    return el.nodeType === 3;
  }
  isElementNode(el) {
    // nodeType element 节点 1
    return el.nodeType === 1;
  }
}

class Observer {
  constructor(data) {
    // 观察对象
    this.observe(data);
  }
  observe(data) {
    if (data && typeof data === "object") {
      Object.keys(data).forEach(key => {
        this.defineReactive(data, key, data[key]);
      });
    }
  }
  defineReactive(obj, key, value) {
    this.observe(value);
    // 每个数据定义的时候 都需要一个 dep 列表来进行依赖的收集
    const dep = new Dep();
    Object.defineProperty(obj, key, {
      get() {
        const target = Dep.target;
        //console.log("$data get:",value);
        target && dep.addWatcher(target);
        return value;
      },
      set: newVal => {
        if (obj[key] === newVal) {
          return;
        }
        //console.log("$data set",newVal);
        this.observe(newVal);
        value = newVal;
        dep.notify(); // 通知数据进行更新
      }
    });
  }
}

class Vue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    this.$options = options;

    // 触发 this.$data.xx 和模版的绑定
    // 新建一个观察者
    new Observer(this.$data);
    // 处理模版部分 将模版中使用的data变量和模版绑定起来
    new Compliler(this.$el, this);
    // 将 options.data 里面的内容转发到 this上面
    this.proxyData(this.$data);
  }
  proxyData(data) {
    Object.keys(data).forEach(key => {
      Object.defineProperty(this, key, {
        get() {
          //console.log("data getter 触发了！");
          return data[key];
        },
        set(newVal) {
          data[key] = newVal;
          //console.log("data setter 触发了");
        }
      });
    });
  }
}
