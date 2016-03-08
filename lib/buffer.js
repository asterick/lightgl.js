"use strict";

// ### new GL.Buffer(target, type)
//
// Provides a simple method of uploading data to a GPU buffer. Example usage:
//
//     var vertices = new GL.Buffer(gl.ARRAY_BUFFER, Float32Array);
//     var indices = new GL.Buffer(gl.ELEMENT_ARRAY_BUFFER, Uint16Array);
//     vertices.data = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]];
//     indices.data = [[0, 1, 2], [2, 1, 3]];
//     vertices.compile();
//     indices.compile();
//
function Buffer(target, type) {
  this.buffer = null;
  this.target = target;
  this.type = type;
  this.data = [];
}

Buffer.prototype = {
  // ### .compile(type)
  //
  // Upload the contents of `data` to the GPU in preparation for rendering. The
  // data must be a list of lists where each inner list has the same length. For
  // example, each element of data for vertex normals would be a list of length three.
  // This will remember the data length and element length for later use by shaders.
  // The type can be either `gl.STATIC_DRAW` or `gl.DYNAMIC_DRAW`, and defaults to
  // `gl.STATIC_DRAW`.
  //
  // This could have used `[].concat.apply([], this.data)` to flatten
  // the array but Google Chrome has a maximum number of arguments so the
  // concatenations are chunked to avoid that limit.
  compile: function(type) {
    var data = [];
    for (var i = 0, chunk = 10000; i < this.data.length; i += chunk) {
      data = Array.prototype.concat.apply(data, this.data.slice(i, i + chunk));
    }
    var spacing = this.data.length ? data.length / this.data.length : 0;
    if (spacing != Math.round(spacing)) throw new Error('buffer elements not of consistent size, average size is ' + spacing);
    this.buffer = this.buffer || gl.createBuffer();
    this.buffer.length = data.length;
    this.buffer.spacing = spacing;
    gl.bindBuffer(this.target, this.buffer);
    gl.bufferData(this.target, new this.type(data), type || gl.STATIC_DRAW);
  }
};

module.exports = Buffer;
