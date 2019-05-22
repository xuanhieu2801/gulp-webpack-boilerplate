import fs from "fs";
import del from "del";
import gulp from "gulp";
import debug from "gulp-debug";
import plumber from "gulp-plumber";
import notifier from "node-notifier";
import { obj as through } from "through2";
import pug from "gulp-pug";
import gulpLoadPlugins from "gulp-load-plugins";
import newer from "gulp-newer";
import cached from "gulp-cached";
import gulpIf from "gulp-if";
import sass from "gulp-sass";

const plugins = gulpLoadPlugins({
  rename: {
    "gulp-google-webfonts": "googleFonts",
  },
});

const paths = {
  build: {
    root: "./dist/",
    fontsDir: "./dist/fonts/",
  },
  src: {
    pug: "./src/templates/pages/*.pug",
    vendorDir: "./src/vendor/",
  },
  googleFonts: {
    list: "./src/fonts/fonts.list",
    fontsDir: "./src/vendor/googleFonts/fonts/",
    woff: "./src/vendor/googleFonts/fonts/**/*.woff",
    cssDir: "./src/vendor/googleFonts/styles/",
    css: "./src/vendor/googleFonts/styles/fonts.css",
  },
  bootstrap: {
    src: {
      scssDir: "./node_modules/bootstrap/scss/",
      scss: "node_modules/bootstrap/scss/**/*.*",
      jsDir: "./node_modules/bootstrap/js/src/",
      js: "node_modules/bootstrap/js/src/**/*.*",
    },
    customSrc: {
      root: "./src/vendor/bootstrap/",
      scssDir: "./src/vendor/bootstrap/scss/",
      jsDir: "./src/vendor/bootstrap/js/src/",
    },
    scssEntryFile: "./src/styles/bootstrap/bootstrap.scss",
  },
  nodeModules: {
    root: "./node_modules/",
  },
};

const GOOGLE_FONTS_ENABLED = true;
const BOOTSTRAP_ENABLED = true;
const BOOTSTRAP_CUSTOM_SOURCE = true;

const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === "development";

const isProduction = !isDevelopment;

const checkDirExist = (location, callback) => {
  fs.access(location, fs.constants.F_OK, callback);
};

const errorHandler = taskName => plumber({
  errorHandler: error => notifier.notify({
    title: `[${taskName}] Error : `,
    message: error.message,
  }),
});

const pathFileNameToPugFile = () => through((file, enc, callback) => {
  const newFile = file;
  newFile.data = Object.assign(file.data || {}, { location: file.stem });
  callback(null, newFile);
});

const printFileName = taskname => debug({ title: `[${taskname}] Add : ` });

function cleanBuildDir(finishTask) {
  if (isProduction) return del(paths.build.root);
  finishTask();
}

function convertPugToHtml() {
  return gulp
    .src(paths.src.pug, {
      since: gulp.lastRun(convertPugToHtml),
    })
    .pipe(errorHandler("ConvertPugToHtml"))
    .pipe(pathFileNameToPugFile())
    .pipe(
      pug({
        pretty: true,
        self: true,
      }),
    )
    .pipe(printFileName("ConvertPugToHtml"))
    .pipe(gulp.dest(paths.build.root));
}

function downloadGoogleFonts() {
  return new Promise(resolve => {
    gulp
      .src(paths.googleFonts.list)
      .pipe(errorHandler("DownloadGoogleFonts"))
      .pipe(
        plugins.googleFonts({
          fontsDir: paths.googleFonts.fontsDir,
          cssDir: paths.googleFonts.cssDir,
          cssFilename: "fonts.css",
          relativePaths: true,
        }),
      )
      .pipe(printFileName("DownloadGoogleFonts"))
      .pipe(gulp.dest("./"))
      .on("end", resolve);
  });
}

function copyGoogleFonts(finishTask) {
  if (GOOGLE_FONTS_ENABLED) {
    checkDirExist(paths.googleFonts.fontsDir, noDir => {
      const copyToDest = () => {
        gulp
          .src(paths.googleFonts.woff)
          .pipe(newer(paths.build.fontsDir))
          .pipe(printFileName("CopyGoogleFonts"))
          .pipe(gulp.dest(paths.build.fontsDir))
          .on("end", finishTask);
      };

      if (noDir) {
        downloadGoogleFonts().then(() => {
          copyToDest();
        });
      } else copyToDest();
    });
  } else finishTask();
}

const getGoogleFontsCss = () => gulp.src(paths.googleFonts.css).pipe(cached("styles"));

function copyBootstrapSource(finishTask) {
  if (BOOTSTRAP_ENABLED && BOOTSTRAP_CUSTOM_SOURCE) {
    checkDirExist(paths.bootstrap.customSrc.root, noDir => {
      if (noDir) {
        gulp
          .src([paths.bootstrap.src.scss, paths.bootstrap.src.js], {
            base: paths.nodeModules.root,
          })
          .pipe(errorHandler("CopyBootstrapSource"))
          .pipe(printFileName("CopyBootstrapSource"))
          .pipe(gulp.dest(paths.src.vendorDir))
          .on("end", finishTask);
      } else finishTask();
    });
  } else finishTask();
}

const convertBootstrapScssToCss = () => gulp
  .src(paths.bootstrap.scssEntryFile)
  .pipe(
    gulpIf(
      BOOTSTRAP_CUSTOM_SOURCE,
      sass({ includePaths: paths.bootstrap.customSrc.scssDir }),
      sass({ includePaths: paths.bootstrap.src.scssDir }),
    ),
  );

const build = gulp.series(
  cleanBuildDir,
  convertPugToHtml,
  copyGoogleFonts,
  copyBootstrapSource,
);

export { build };
export { build as default };
