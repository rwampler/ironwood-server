'use strict';

const fs = require('fs');
const _ = require('lodash');

module.exports = function(grunt) {
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  grunt.initConfig({
    clean: {
      build: ['dist/']
    },

    copy: {
      json: {
        files: [
          { expand: true, cwd: 'src', src: ['**/*.json', '!**/tsconfig.json'], dest: 'dist/app/' },
          { expand: true, cwd: 'tst', src: ['**/*.json', '!**/tsconfig.json'], dest: 'dist/tst/' }
        ],
      },
    },

    jshint: {
      default: {
        options: {
          jshintrc: true
        },
        src: ['Gruntfile.js', 'src/**/*.js', 'tst/**/*.js']
      }
    },

    babel: {
      options: {
        sourceMap: false,
        presets: ['@babel/preset-env'],
        targets: {
          "node": 16
        }
      },
      dist: {
        files: [
          { expand: true, cwd: 'src', src: ['**/*.js'], dest: 'dist/app/' },
          { expand: true, cwd: 'tst', src: ['**/*.js'], dest: 'dist/tst/' }
        ]
      }
    },

    ts: {
      default : {
        tsconfig: 'tsconfig.json',
        outDir: 'dist/app',
        options: {
          rootDir: 'src'
        }
      }
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          quiet: false
        },
        src: ['dist/tst/**/*.test.js']
      }
    }
  });

  grunt.registerTask('build', ['babel', 'copy:json', 'ts']);
  grunt.registerTask('default', ['clean', 'jshint', 'build', 'mochaTest']);

};
