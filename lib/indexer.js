"use strict";

// Represents indexed triangle geometry with arbitrary additional attributes.
// You need a shader to draw a mesh; meshes can't draw themselves.
//
// A mesh is a collection of `GL.Buffer` objects which are either vertex buffers
// (holding per-vertex attributes) or index buffers (holding the order in which
// vertices are rendered). By default, a mesh has a position vertex buffer called
// `vertices` and a triangle index buffer called `triangles`. New buffers can be
// added using `addVertexBuffer()` and `addIndexBuffer()`. Two strings are
// required when adding a new vertex buffer, the name of the data array on the
// mesh instance and the name of the GLSL attribute in the vertex shader.
//
// Example usage:
//
//     var mesh = new GL.Mesh({ coords: true, lines: true });
//
//     // Default attribute "vertices", available as "gl_Vertex" in
//     // the vertex shader
//     mesh.vertices = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]];
//
//     // Optional attribute "coords" enabled in constructor,
//     // available as "gl_TexCoord" in the vertex shader
//     mesh.coords = [[0, 0], [1, 0], [0, 1], [1, 1]];
//
//     // Custom attribute "weights", available as "weight" in the
//     // vertex shader
//     mesh.addVertexBuffer('weights', 'weight');
//     mesh.weights = [1, 0, 0, 1];
//
//     // Default index buffer "triangles"
//     mesh.triangles = [[0, 1, 2], [2, 1, 3]];
//
//     // Optional index buffer "lines" enabled in constructor
//     mesh.lines = [[0, 1], [0, 2], [1, 3], [2, 3]];
//
//     // Upload provided data to GPU memory
//     mesh.compile();

// ### new GL.Indexer()
//
// Generates indices into a list of unique objects from a stream of objects
// that may contain duplicates. This is useful for generating compact indexed
// meshes from unindexed data.
function Indexer() {
  this.unique = [];
  this.indices = [];
  this.map = {};
}

Indexer.prototype = {
  // ### .add(v)
  //
  // Adds the object `obj` to `unique` if it hasn't already been added. Returns
  // the index of `obj` in `unique`.
  add: function(obj) {
    var key = JSON.stringify(obj);
    if (!(key in this.map)) {
      this.map[key] = this.unique.length;
      this.unique.push(obj);
    }
    return this.map[key];
  }
};

module.exports = Indexer;
