import gulp from 'gulp';
import ejs from 'gulp-ejs';
import prettier from 'gulp-prettier';
import using from 'gulp-using';
import newer from 'gulp-newer';
import { deleteSync } from 'del';
import gulpSass from 'gulp-sass';
import * as sass from 'sass';
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
const pathSRCResource = `${pathSRC}resource/`;
const pathDIST = './dist/';
const pathDISTResource = `${pathDIST}resource/`;

const paths = {
	src: {
		html: [`${pathSRC}page/**/*.html`, `!${pathSRC}page/include/**`],
		include: `${pathSRC}page/include`,
		js: `${pathSRCResource}js/**/*.js`,
		css: `${pathSRCResource}sass/**/*.scss`,
		image: `${pathSRCResource}image/**/*`,
		font: `${pathSRCResource}font/**/*`
	},
	dist: {
		root: pathDIST,
		html: `${pathDIST}page`,
		js: `${pathDISTResource}js`,
		css: `${pathDISTResource}css`,
		sass: `${pathDISTResource}sass`,
		image: `${pathDISTResource}image`,
		font: `${pathDISTResource}font`
	}
};

// 'dist' 디렉토리를 삭제하는 함수
export async function clean() {
	deleteSync([paths.dist.html, `${pathDIST}resource`]);
}
clean.displayName = `🌟 CleanAll`;

// 'dist/page' 디렉토리를 삭제하는 함수
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
			file: `${paths.dist.js}/main.js`,
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
	return gulp.src(paths.src.css)
		.pipe(sourcemaps.init())
		.pipe(gulpSass(sass)({
			outputStyle: 'compressed' /* expanded:확장, compressed:압축 */
		}).on('error', gulpSass(sass).logError))
		.pipe(sourcemaps.write('../scss'))
		.pipe(gulp.dest(paths.dist.css))
		.pipe(bs.stream());
}

// 이미지 파일을 최적화하고 복사하는 함수
export function optimizeImage() {
	deleteSync(paths.dist.image);
	return gulp.src(paths.src.image, { buffer: true, encoding: false })
		.pipe(newer(paths.dist.image))
		.pipe(imagemin([
			mozjpeg({ quality: 75, progressive: true }),
			optipng({ optimizationLevel: 5 }),
			giflossy({ optimizationLevel: 3 })
		]))
		.pipe(gulp.dest(paths.dist.image))
		.pipe(bs.stream());
}

// 폰트 파일을 초기화하고 복사하는 함수
export function copyFont() {
	deleteSync(paths.dist.font);
	return gulp.src(paths.src.font, { buffer: true, encoding: false })
		.pipe(newer(paths.dist.font))
		.pipe(gulp.dest(paths.dist.font))
		.pipe(bs.stream());
}

// 브라우저 동기화를 위한 서버 시작 함수
export function serve(done) {
	bs.init({
		startPath: 'page/main/index.html',
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
	gulp.watch(paths.src.font, copyFont);
}

// 기본 작업으로 'clean' 작업 후 'buildJS', 'compileSass', 'buildHtml', 'optimizeImage' 작업을 실행
export default gulp.series(
	clean,
	gulp.parallel(buildJS, compileSass, buildHtml, optimizeImage, copyFont),
	serve,
	watchFiles
);