///// Gulp Dependencies /////
var gulp = require('gulp'),
	sass = require('gulp-sass'),
	concat = require('gulp-concat'),
	cleanCSS = require('gulp-clean-css'),
	rename = require("gulp-rename"),
	spawn = require('child_process').spawn,
	node;

////// Build Tasks ///////
gulp.task('build-sass', function () {
	gulp.src('./src/scss/*.scss')
		.pipe(sass().on('error', sass.logError))
		.pipe(gulp.dest('./src/scss/temp'))						//build them here first
		.pipe(concat('main.css'))							//concat them all
		.pipe(gulp.dest('./public/css'))
		.pipe(cleanCSS())										//minify
		.pipe(rename("main.min.css"))
		.pipe(gulp.dest('./public/css'));						//dump it here
});

////// Run Server Task ///////
gulp.task('server', function() {
	if (node) node.kill();
	node = spawn('node', ['app.js'], {stdio: 'inherit'});		//command, file, options
});

////// Watch Tasks //////
gulp.task('watch-sass', ['build-sass'], function () {
	gulp.watch('./src/scss/*.scss', ['build-sass']);
});
gulp.task('watch-server', ['server'], function () {
	gulp.watch('./routes/**/*.js', ['server']);
	gulp.watch(['./utils/**/*.js', '!./temp/**'], ['server']);
	gulp.watch('./setup.js', ['server']);
	gulp.watch('./app.js', ['server']);
});


////// Default //////
gulp.task('default', ['watch-sass', 'watch-server'], function(){});
