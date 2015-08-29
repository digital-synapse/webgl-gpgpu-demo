﻿
(function () {
    // must disable premultiplied alpha to get use of 
    // all 4 bytes of each pixel for computational output
    var renderer = new THREE.WebGLRenderer({ premultipliedAlpha: false, antialias: false });
    var gl = renderer.context;
    if (!gl) throw ("Requires WebGL rendering context!");
    if (!gl.getExtension("OES_texture_float")) {
        throw ("Requires OES_texture_float extension");
    }
    var MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE) / 4;
    var ajaxcache = [];

    //-- Easy ajax load --------------------------------------------------------
    // url: the path the the resource to GET
    // success: callback function for async load ( params: response content )
    // fail: callback function for async load ( params: error status code )
    // cache: boolean flag to enable caching
    //  notes: success and fail callbacks are optional. If ommited function will
    //         perform a syncronous get on the main thread and return the response
    //---------------------------------------------------------------------------
    window.ajax = ajax;
    function ajax(args) {
        var url = args.url;
        var success = args.success;
        var fail = args.fail;
        var cache = args.cache;

        if (cache) {
            for (var i = 0; i < ajaxcache.length; i++) {
                if (ajaxcache[i].url == url) {
                    if (success) success(ajaxcache[i].responseText);
                    else return ajaxcache[i].responseText;
                    return;
                }
            }
        }
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState == 4) {
                if (xmlhttp.status == 200)
                    if (success) {
                        if (cache) ajaxcache.push({ url: url, responseText: xmlhttp.responseText });
                        success(xmlhttp.responseText);
                        return;
                    } else {
                        if (fail) {
                            fail(xmlhttp.status);
                            return;
                        }
                    }
            }
        };
        xmlhttp.open("GET", url, (success || fail));
        xmlhttp.send();
        if (cache) ajaxcache.push({ url: url, responseText: xmlhttp.responseText });
        return xmlhttp.responseText || xmlhttp.status;
    }


    //-- Make Float Texture ----------------------------------------------------
    // data: an array of values (4 floats per pixel)
    // width: (optional)
    // height: (optional)
    //--------------------------------------------------------------------------
    function createFloatingPointTextureFromData(data, size) {

        if (!size) size = findBestTextureSize(data.length);
        //alert(MAX_TEXTURE_SIZE + '\n' + size.dimension);

        // trick to do a super fast array resize that will actually allocate 
        // the memory unlike setting array.length which does nothing 
        //console.time('allocate array');
        if (data.length < size.length) data[size.length - 1] = 0;
        //console.timeEnd('allocate array');

        var texture = new THREE.Texture();
        texture.needsUpdate = false;
        texture.__webglTexture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture.__webglTexture);


        //console.time('load Float32Array');

        var buffer;
        if (Object.prototype.toString.call(data) === "[object Float32Array]")
            buffer = data;
        else
            buffer = new Float32Array(data);
        //console.timeEnd('load Float32Array');

        //console.time('loadTexture');
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.dimension, size.dimension, 0, gl.RGBA, gl.FLOAT, buffer);
        texture.__webglInit = false;
        //console.timeEnd('loadTexture');

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }


    function findBestTextureSize(length) {
        var pixels = length / 4; // rgba
        var sqrt = Math.sqrt(pixels);
        var size;
        if (sqrt > MAX_TEXTURE_SIZE) throw ('Error: Too Much Data. Multiple texure buffers are not yet supported.');
        else if (sqrt > 8192) size = 16384;
        else if (sqrt > 4096) size = 8192;
        else if (sqrt > 2048) size = 4096;
        else if (sqrt > 1024) size = 2048;
        else if (sqrt > 512) size = 1024;
        else if (sqrt > 256) size = 512;
        else if (sqrt > 128) size = 256;
        else if (sqrt > 64) size = 128;
        else if (sqrt > 32) size = 64;
        else if (sqrt > 16) size = 32;
        else if (sqrt > 8) size = 16;
        else if (sqrt > 4) size = 8;
        else if (sqrt > 2) size = 4;
        else size = 2;

        return {
            dimension: size,
            length: size * size * 4 /* return the ideal buffer length */
        };
    }

    window.gpgpu = gpgpu;
    function gpgpu(shader, data, callback) {

        function _gpgpu(fragment, vertex) {
            var size = findBestTextureSize(data.length);
            var simRes = size.dimension;
            var cameraRTT = new THREE.OrthographicCamera(simRes / -2, simRes / 2, simRes / 2, simRes / -2, -10000, 10000);
            var sceneRTT = new THREE.Scene();
            var geometry = new THREE.PlaneBufferGeometry(simRes, simRes);
            var uniforms = {
                texture1: { type: "t", value: createFloatingPointTextureFromData(data, size) }
            };
            var material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertex,
                fragmentShader: fragment, //load('shaders/fragment.glsl'),
                blending: 0
            });
            var mesh = new THREE.Mesh(geometry, material);
            sceneRTT.add(mesh);
            var renderTargetLinearFloatParams = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                wrapS: THREE.RenderTargetWrapping,
                wrapT: THREE.RenderTargetWrapping,
                format: THREE.RGBAFormat,
                stencilBuffer: !1,
                depthBuffer: !1,
                type: THREE.FloatType
            };
            var rtTexture = new THREE.WebGLRenderTarget(simRes, simRes, renderTargetLinearFloatParams);
            renderer.render(sceneRTT, cameraRTT, rtTexture, true);
            var gl = renderer.getContext();
            var buffer = new Float32Array(size.length);
            gl.readPixels(0, 0, simRes, simRes, gl.RGBA, gl.FLOAT, buffer);
            
            // return buffer
            if (callback) callback(buffer);            
        }
        setTimeout(function () {
            _gpgpu(shader.fragment, shader.vertex);
            /*
            function start() {
            if (fragment.substr(fragment.length - 5) == '.glsl') {
            ajax({
            url: fragment,
            success: function (fragment) { _gpgpu(fragment, self.vertexshader); },
            cache: true
            });
            } else _gpgpu(fragment, self.vertexshader);
            }
            var self = this;
            if (!this.vertexshader) {


            ajax({
            url: 'shaders/vertex.glsl',
            success: function (shader) {
            self.vertexshader = shader;
            start();
            },
            cache: true
            });
            } else {
            start();
            }
            */
        });
    }

    window.glsl = glsl;
    function glsl(fn) {

        function _stripComments(fnStr) {
            var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
            return fnStr.replace(STRIP_COMMENTS, '');
        }
        function _replaceReturn(fnStr) {
            return fnStr.replace('return ', 'gl_FragColor =');
        }
        function _stripWhiteSpace(fnStr) {
            return fnStr.replace(/\s/g, '');
        }
        function _getParamNames(fnStr) {
            var ARGUMENT_NAMES = /([^\s,]+)/g;
            var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES)
            if (result === null)
                result = [];
            return result;
        }

        var src = _stripWhiteSpace(_replaceReturn(_stripComments(fn.toString())));
        var param = _getParamNames(src)[0];
        src = src.slice(src.indexOf('{') + 1, src.lastIndexOf('}') + 1);
        src = src.replace(/Math./g, '');
        src = src.replace(/var/g, 'vec4');
        var header = 'uniform sampler2D texture1;varying vec2 vUv;void main() {vec4 ' + param + ' = texture2D(texture1, vUv);'
        return {
            vertex: 'varying vec2 vUv;void main() {vUv = uv;gl_Position =   projectionMatrix * modelViewMatrix * vec4(position,1.0);}',
            fragment: header + src
        };
    }
})();