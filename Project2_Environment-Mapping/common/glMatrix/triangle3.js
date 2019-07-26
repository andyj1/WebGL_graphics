"use strict";

var gl;

window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    // create an array of three 2D vertices using glMatrix vec2 type
    // vec2.fromValues creates a typed array of two Float32's
/*
    var vertices = [];
    vertices.push(vec2.fromValues(-1, -1));
    vertices.push(vec2.fromValues(0, 1));
    vertices.push(vec2.fromValues(1, -1));
*/

    var vertices = [
      vec2.fromValues(-1, -1),
      vec2.fromValues(0, 1),
      vec2.fromValues(1, -1)
  ];

    // put the data into a single Float32Array to send to GPU

    var vertexData = new Float32Array(2*vertices.length);

    for(var i = 0; i<vertices.length; i++) {
      vertexData.set(vertices[i], 2*i);
    }

    //  Configure WebGL

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    //  Load shaders and initialize attribute buffers

    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Load the data into the GPU

    var bufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    gl.bufferData( gl.ARRAY_BUFFER,vertexData, gl.STATIC_DRAW );

    // Associate our shader variables with our data buffer

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    render();
};


function render() {
    gl.clear( gl.COLOR_BUFFER_BIT );
    gl.drawArrays( gl.TRIANGLES, 0, 3 );
}
