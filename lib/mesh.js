"use strict";

var Vector = require("./vector.js");
var Buffer = require("./buffer.js");
var Indexer = require("./indexer.js");

// ### new GL.Mesh([options])
//
// Represents a collection of vertex buffers and index buffers. Each vertex
// buffer maps to one attribute in GLSL and has a corresponding property set
// on the Mesh instance. There is one vertex buffer by default: `vertices`,
// which maps to `gl_Vertex`. The `coords`, `normals`, and `colors` vertex
// buffers map to `gl_TexCoord`, `gl_Normal`, and `gl_Color` respectively,
// and can be enabled by setting the corresponding options to true. There are
// two index buffers, `triangles` and `lines`, which are used for rendering
// `gl.TRIANGLES` and `gl.LINES`, respectively. Only `triangles` is enabled by
// default, although `computeWireframe()` will add a normal buffer if it wasn't
// initially enabled.
function Mesh(options) {
  options = options || {};
  this.vertexBuffers = {};
  this.indexBuffers = {};
  this.addVertexBuffer('vertices', 'gl_Vertex');
  if (options.coords) this.addVertexBuffer('coords', 'gl_TexCoord');
  if (options.normals) this.addVertexBuffer('normals', 'gl_Normal');
  if (options.colors) this.addVertexBuffer('colors', 'gl_Color');
  if (!('triangles' in options) || options.triangles) this.addIndexBuffer('triangles');
  if (options.lines) this.addIndexBuffer('lines');
}

Mesh.prototype = {
  // ### .addVertexBuffer(name, attribute)
  //
  // Add a new vertex buffer with a list as a property called `name` on this object
  // and map it to the attribute called `attribute` in all shaders that draw this mesh.
  addVertexBuffer: function(name, attribute) {
    var buffer = this.vertexBuffers[attribute] = new Buffer(gl.ARRAY_BUFFER, Float32Array);
    buffer.name = name;
    this[name] = [];
  },

  // ### .addIndexBuffer(name)
  //
  // Add a new index buffer with a list as a property called `name` on this object.
  addIndexBuffer: function(name) {
    this.indexBuffers[name] = new Buffer(gl.ELEMENT_ARRAY_BUFFER, Uint16Array);
    this[name] = [];
  },

  // ### .compile()
  //
  // Upload all attached buffers to the GPU in preparation for rendering. This
  // doesn't need to be called every frame, only needs to be done when the data
  // changes.
  compile: function() {
    var buffer;
    for (var attribute in this.vertexBuffers) {
      buffer = this.vertexBuffers[attribute];
      buffer.data = this[buffer.name];
      buffer.compile();
    }

    for (var name in this.indexBuffers) {
      buffer = this.indexBuffers[name];
      buffer.data = this[name];
      buffer.compile();
    }
  },

  // ### .transform(matrix)
  //
  // Transform all vertices by `matrix` and all normals by the inverse transpose
  // of `matrix`.
  transform: function(matrix) {
    this.vertices = this.vertices.map(function(v) {
      return matrix.transformPoint(Vector.fromArray(v)).toArray();
    });
    if (this.normals) {
      var invTrans = matrix.inverse().transpose();
      this.normals = this.normals.map(function(n) {
        return invTrans.transformVector(Vector.fromArray(n)).unit().toArray();
      });
    }
    this.compile();
    return this;
  },

  // ### .computeNormals()
  //
  // Computes a new normal for each vertex from the average normal of the
  // neighboring triangles. This means adjacent triangles must share vertices
  // for the resulting normals to be smooth.
  computeNormals: function() {
    var i;

    if (!this.normals) this.addVertexBuffer('normals', 'gl_Normal');
    for (i = 0; i < this.vertices.length; i++) {
      this.normals[i] = new Vector();
    }
    for (i = 0; i < this.triangles.length; i++) {
      var t = this.triangles[i];
      var a = Vector.fromArray(this.vertices[t[0]]);
      var b = Vector.fromArray(this.vertices[t[1]]);
      var c = Vector.fromArray(this.vertices[t[2]]);
      var normal = b.subtract(a).cross(c.subtract(a)).unit();
      this.normals[t[0]] = this.normals[t[0]].add(normal);
      this.normals[t[1]] = this.normals[t[1]].add(normal);
      this.normals[t[2]] = this.normals[t[2]].add(normal);
    }
    for (i = 0; i < this.vertices.length; i++) {
      this.normals[i] = this.normals[i].unit().toArray();
    }
    this.compile();
    return this;
  },

  // ### .computeWireframe()
  //
  // Populate the `lines` index buffer from the `triangles` index buffer.
  computeWireframe: function() {
    var indexer = new Indexer();
    for (var i = 0; i < this.triangles.length; i++) {
      var t = this.triangles[i];
      for (var j = 0; j < t.length; j++) {
        var a = t[j], b = t[(j + 1) % t.length];
        indexer.add([Math.min(a, b), Math.max(a, b)]);
      }
    }
    if (!this.lines) this.addIndexBuffer('lines');
    this.lines = indexer.unique;
    this.compile();
    return this;
  },

  // ### .getAABB()
  //
  // Computes the axis-aligned bounding box, which is an object whose `min` and
  // `max` properties contain the minimum and maximum coordinates of all vertices.
  getAABB: function() {
    var aabb = { min: new Vector(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE) };
    aabb.max = aabb.min.negative();
    for (var i = 0; i < this.vertices.length; i++) {
      var v = Vector.fromArray(this.vertices[i]);
      aabb.min = Vector.min(aabb.min, v);
      aabb.max = Vector.max(aabb.max, v);
    }
    return aabb;
  },

  // ### .getBoundingSphere()
  //
  // Computes a sphere that contains all vertices (not necessarily the smallest
  // sphere). The returned object has two properties, `center` and `radius`.
  getBoundingSphere: function() {
    var aabb = this.getAABB();
    var sphere = { center: aabb.min.add(aabb.max).divide(2), radius: 0 };
    for (var i = 0; i < this.vertices.length; i++) {
      sphere.radius = Math.max(sphere.radius,
        Vector.fromArray(this.vertices[i]).subtract(sphere.center).length());
    }
    return sphere;
  }
};

// ### GL.Mesh.plane([options])
//
// Generates a square 2x2 mesh the xy plane centered at the origin. The
// `options` argument specifies options to pass to the mesh constructor.
// Additional options include `detailX` and `detailY`, which set the tesselation
// in x and y, and `detail`, which sets both `detailX` and `detailY` at once.
// Two triangles are generated by default.
// Example usage:
//
//     var mesh1 = GL.Mesh.plane();
//     var mesh2 = GL.Mesh.plane({ detail: 5 });
//     var mesh3 = GL.Mesh.plane({ detailX: 20, detailY: 40 });
//
Mesh.plane = function(options) {
  options = options || {};
  var mesh = new Mesh(options);
  var detailX = options.detailX || options.detail || 1;
  var detailY = options.detailY || options.detail || 1;

  for (var y = 0; y <= detailY; y++) {
    var t = y / detailY;
    for (var x = 0; x <= detailX; x++) {
      var s = x / detailX;
      mesh.vertices.push([2 * s - 1, 2 * t - 1, 0]);
      if (mesh.coords) mesh.coords.push([s, t]);
      if (mesh.normals) mesh.normals.push([0, 0, 1]);
      if (x < detailX && y < detailY) {
        var i = x + y * (detailX + 1);
        mesh.triangles.push([i, i + 1, i + detailX + 1]);
        mesh.triangles.push([i + detailX + 1, i + 1, i + detailX + 2]);
      }
    }
  }

  mesh.compile();
  return mesh;
};

var cubeData = [
  [0, 4, 2, 6, -1, 0, 0], // -x
  [1, 3, 5, 7, +1, 0, 0], // +x
  [0, 1, 4, 5, 0, -1, 0], // -y
  [2, 6, 3, 7, 0, +1, 0], // +y
  [0, 2, 1, 3, 0, 0, -1], // -z
  [4, 5, 6, 7, 0, 0, +1]  // +z
];

function pickOctant(i) {
  return new Vector((i & 1) * 2 - 1, (i & 2) - 1, (i & 4) / 2 - 1);
}

// ### GL.Mesh.cube([options])
//
// Generates a 2x2x2 box centered at the origin. The `options` argument
// specifies options to pass to the mesh constructor.
Mesh.cube = function(options) {
  var mesh = new Mesh(options);

  for (var i = 0; i < cubeData.length; i++) {
    var data = cubeData[i], v = i * 4;
    for (var j = 0; j < 4; j++) {
      var d = data[j];
      mesh.vertices.push(pickOctant(d).toArray());
      if (mesh.coords) mesh.coords.push([j & 1, (j & 2) / 2]);
      if (mesh.normals) mesh.normals.push(data.slice(4, 7));
    }
    mesh.triangles.push([v, v + 1, v + 2]);
    mesh.triangles.push([v + 2, v + 1, v + 3]);
  }

  mesh.compile();
  return mesh;
};

// ### GL.Mesh.sphere([options])
//
// Generates a geodesic sphere of radius 1. The `options` argument specifies
// options to pass to the mesh constructor in addition to the `detail` option,
// which controls the tesselation level. The detail is `6` by default.
// Example usage:
//
//     var mesh1 = GL.Mesh.sphere();
//     var mesh2 = GL.Mesh.sphere({ detail: 2 });
//
Mesh.sphere = function(options) {
  function tri(a, b, c) { return flip ? [a, c, b] : [a, b, c]; }
  function fix(x) { return x + (x - x * x) / 2; }
  options = options || {};
  var mesh = new Mesh(options);
  var indexer = new Indexer();
  var detail = options.detail || 6;

  for (var octant = 0; octant < 8; octant++) {
    var scale = pickOctant(octant);
    var flip = scale.x * scale.y * scale.z > 0;
    var data = [];
    var i, j, a, b, c;

    for (i = 0; i <= detail; i++) {
      // Generate a row of vertices on the surface of the sphere
      // using barycentric coordinates.
      for (j = 0; i + j <= detail; j++) {
        a = i / detail;
        b = j / detail;
        c = (detail - i - j) / detail;
        var vertex = { vertex: new Vector(fix(a), fix(b), fix(c)).unit().multiply(scale).toArray() };
        if (mesh.coords) vertex.coord = scale.y > 0 ? [1 - a, c] : [c, 1 - a];
        data.push(indexer.add(vertex));
      }

      // Generate triangles from this row and the previous row.
      if (i > 0) {
        for (j = 0; i + j <= detail; j++) {
          a = (i - 1) * (detail + 1) + ((i - 1) - (i - 1) * (i - 1)) / 2 + j;
          b = i * (detail + 1) + (i - i * i) / 2 + j;
          mesh.triangles.push(tri(data[a], data[a + 1], data[b]));
          if (i + j < detail) {
            mesh.triangles.push(tri(data[b], data[a + 1], data[b + 1]));
          }
        }
      }
    }
  }

  // Reconstruct the geometry from the indexer.
  mesh.vertices = indexer.unique.map(function(v) { return v.vertex; });
  if (mesh.coords) mesh.coords = indexer.unique.map(function(v) { return v.coord; });
  if (mesh.normals) mesh.normals = mesh.vertices;
  mesh.compile();
  return mesh;
};

// ### GL.Mesh.load(json[, options])
//
// Creates a mesh from the JSON generated by the `convert/convert.py` script.
// Example usage:
//
//     var data = {
//       vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
//       triangles: [[0, 1, 2]]
//     };
//     var mesh = GL.Mesh.load(data);
//
Mesh.load = function(json, options) {
  options = options || {};
  if (!('coords' in options)) options.coords = !!json.coords;
  if (!('normals' in options)) options.normals = !!json.normals;
  if (!('colors' in options)) options.colors = !!json.colors;
  if (!('triangles' in options)) options.triangles = !!json.triangles;
  if (!('lines' in options)) options.lines = !!json.lines;
  var mesh = new Mesh(options);
  mesh.vertices = json.vertices;
  if (mesh.coords) mesh.coords = json.coords;
  if (mesh.normals) mesh.normals = json.normals;
  if (mesh.colors) mesh.colors = json.colors;
  if (mesh.triangles) mesh.triangles = json.triangles;
  if (mesh.lines) mesh.lines = json.lines;
  mesh.compile();
  return mesh;
};

module.exports = Mesh;
