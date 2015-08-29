window.$ = function (a) {
    var b = "string" == typeof a ? document.getElementById(a.replace("#", "")) : a; return { onClick: function (a) { b.addEventListener("click", a) }, val: function (a) {
        if (a) b.value = a;
        else return b.value;
    }, ready: function (a) { b.addEventListener("DOMContentLoaded", a) } 
    }
};
