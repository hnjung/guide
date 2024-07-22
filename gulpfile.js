import gulp from 'gulp';
import ejs from 'gulp-ejs';
import prettier from 'gulp-prettier';
import using from 'gulp-using';
import newer from 'gulp-newer';
import { deleteSync } from 'del';
import gulpSass from 'gulp-sass';
import * as sass from 'sass';
import imagemin from 'gulp-imagemin';
import mozjpeg from 'imagemin-mozjpeg';
import optipng from 'imagemin-optipng';
import giflossy from 'imagemin-giflossy';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import { glob } from 'glob';
import browserSync from 'browser-sync';

const bs = browserSync.create();

// 경로 설정
const paths = {
	html: {
		src: ['src/html/**/*.html', '!src/html/include/**'],
		dest: 'dist/html',
	},
	js: {
		src: 'src/js/**/*.js',
		dest: 'dist/js/bundle.js',
	},
	css: {
		src: 'src/scss/**/*.scss',
		dest: 'dist/css',
	},
	image: {
		src: 'src/image/**/*',
		dest: 'dist/image',
	},
};

// 'dist' 디렉토리를 삭제하는 함수
export async function clean() {
	deleteSync(['dist']);
}

// EJS 템플릿을 컴파일하는 함수
export function buildHtml() {
	return gulp.src(paths.html.src)
		.pipe(newer(paths.html.dest))
		.pipe(using({ prefix: '🌟 Processing', path: 'relative', color: 'yellow' }))
		.pipe(ejs({}, { views: 'src/html/include' }).on('error', console.error))
		.pipe(prettier({
			printWidth: 200,
			tabWidth: 4,
			useTabs: true,
			bracketSameLine: true,
		}))
		.pipe(gulp.dest(paths.html.dest))
		.pipe(bs.stream());
}

// JavaScript 파일을 번들링하는 함수
export function buildJS() {
	return rollup({
		input: glob.sync('src/js/**/*.js'),
		plugins: [
			resolve(),
			commonjs(),
			babel({
				babelrc: false,
				exclude: 'node_modules/**',
				presets: [
					[
						'@babel/preset-env',
						{
							useBuiltIns: 'usage',
							corejs: {
								version: 3,
								proposals: false,
							},
						},
					],
				],
				babelHelpers: 'bundled',
				extensions: ['.js'],
			}),
			terser(),
		],
	})
	.then(bundle => {
		return bundle.write({
			file: paths.js.dest,
			format: 'iife',
			name: 'UI',
			sourcemap: true,
		});
	})
	.then(() => {
		bs.reload();
	});
}

// Sass 파일을 컴파일하는 함수
export function compileSass() {
	return gulp.src(paths.css.src)
		.pipe(gulpSass(sass)().on('error', gulpSass(sass).logError))
		.pipe(gulp.dest(paths.css.dest))
		.pipe(bs.stream());
}

// 이미지 파일을 최적화하고 복사하는 함수
export function optimizeImage() {
	return gulp.src(paths.image.src)
		.pipe(newer(paths.image.dest))
		.pipe(imagemin([
			mozjpeg({ quality: 75, progressive: true }),
			optipng({ optimizationLevel: 5 }),
			giflossy({ optimizationLevel: 3 })
		]))
		.pipe(gulp.dest(paths.image.dest))
		.pipe(bs.stream());
}

// 브라우저 동기화를 위한 서버 시작 함수
export function serve(done) {
	bs.init({
		startPath: "html/index.html",
		server: {
			baseDir: './dist'
		},
		notify: false
	});
	done();
}

// 파일 변경을 감시하고 관련 작업을 수행하는 함수
export function watchFiles() {
	gulp.watch(paths.html.src, buildHtml);
	gulp.watch(paths.css.src, compileSass);
	gulp.watch(paths.js.src, buildJS);
	gulp.watch(paths.image.src, optimizeImage);
}

// 기본 작업으로 'clean' 작업 후 'buildJS', 'compileSass', 'buildHtml', 'optimizeImage' 작업을 실행
export default gulp.series(
	clean,
	gulp.parallel(buildJS, compileSass, buildHtml, optimizeImage),
	serve,
	watchFiles
);