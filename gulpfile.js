import gulp from 'gulp';
import ejs from 'gulp-ejs';
import prettier from 'gulp-prettier';
import using from 'gulp-using';
import newer from 'gulp-newer';
import { deleteSync } from 'del';
import gulpSass from 'gulp-sass';
import * as sass from 'sass';
import cleanCSS from 'gulp-clean-css';
import sourcemaps from 'gulp-sourcemaps';
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
const pathSRC = './src/';
const pathDIST = './dist/';
const paths = {
	src: {
		html: [`${pathSRC}html/**/*.html`, `!${pathSRC}html/include/**`],
		include: `${pathSRC}html/include`,
		js: `${pathSRC}js/**/*.js`,
		css: `${pathSRC}scss/**/*.scss`,
		cssFile: `${pathSRC}scss/main.scss`,
		image: `${pathSRC}image/**/*`
	},
	dist: {
		root: pathDIST,
		html: `${pathDIST}html`,
		js: `${pathDIST}js/main.js`,
		css: `${pathDIST}css`,
		image: `${pathDIST}image`
	}
};

// 'dist' 디렉토리를 삭제하는 함수
export async function clean() {
	deleteSync(paths.dist.root);
}
clean.displayName = `🌟 CleanAll`;

// 'dist/html' 디렉토리를 삭제하는 함수
export async function cleanHtml() {
	deleteSync(paths.dist.html);
}
cleanHtml.displayName = `🌟 CleanHTML`;

// EJS 템플릿을 컴파일하는 함수
export function buildHtml() {
	return gulp.src(paths.src.html)
		.pipe(newer(paths.dist.html))
		.pipe(using({ prefix: '🌟 Processing', path: 'relative', color: 'yellow' }))
		.pipe(ejs({}, { views: paths.src.include }).on('error', console.error))
		.pipe(prettier({
			printWidth: 200,
			tabWidth: 4,
			useTabs: true,
			bracketSameLine: true,
		}))
		.pipe(gulp.dest(paths.dist.html))
		.pipe(bs.stream());
}

// JavaScript 파일을 번들링하는 함수
export function buildJS() {
	return rollup({
		input: glob.sync(paths.src.js),
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
			file: paths.dist.js,
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
	return gulp.src(paths.src.cssFile)
		.pipe(sourcemaps.init())
		.pipe(gulpSass(sass)().on('error', gulpSass(sass).logError))
		.pipe(sourcemaps.write())
		.pipe(cleanCSS({ compatibility: 'ie8' }))
		.pipe(gulp.dest(paths.dist.css))
		.pipe(bs.stream());
}

// 이미지 파일을 최적화하고 복사하는 함수
export function optimizeImage() {
	return gulp.src(paths.src.image)
		.pipe(newer(paths.dist.image))
		.pipe(imagemin([
			mozjpeg({ quality: 75, progressive: true }),
			optipng({ optimizationLevel: 5 }),
			giflossy({ optimizationLevel: 3 })
		]))
		.pipe(gulp.dest(paths.dist.image))
		.pipe(bs.stream());
}

// 브라우저 동기화를 위한 서버 시작 함수
export function serve(done) {
	bs.init({
		startPath: "html/index.html",
		server: {
			baseDir: paths.dist.root
		},
		notify: false
	});
	done();
}

// 파일 변경을 감시하고 관련 작업을 수행하는 함수
export function watchFiles() {
	gulp.watch(paths.src.html, buildHtml);
	gulp.watch(paths.src.include, gulp.series(cleanHtml, buildHtml));
	gulp.watch(paths.src.css, compileSass);
	gulp.watch(paths.src.js, buildJS);
	gulp.watch(paths.src.image, optimizeImage);
}

// 기본 작업으로 'clean' 작업 후 'buildJS', 'compileSass', 'buildHtml', 'optimizeImage' 작업을 실행
export default gulp.series(
	clean,
	gulp.parallel(buildJS, compileSass, buildHtml, optimizeImage),
	serve,
	watchFiles
);