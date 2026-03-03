{
  lib,
  buildNpmPackage,
  nodejs,
  esbuild,
  makeWrapper,
}:

buildNpmPackage rec {
  pname = "warp";
  version = "0-unstable-2026-02-27";

  src = ./..;

  npmDepsHash = "sha256-yEWGktCdQwz7kUq3lR3Qb2LB+QJX1+psnCJeOCT+BCM=";

  dontNpmBuild = true;

  nativeBuildInputs = [
    esbuild
    makeWrapper
  ];

  buildPhase = ''
    runHook preBuild

    esbuild src/index.ts \
      --bundle \
      --platform=node \
      --format=cjs \
      --outfile=dist/index.js \
      --minify

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/lib/warp $out/bin
    cp dist/index.js $out/lib/warp/

    makeWrapper ${nodejs}/bin/node $out/bin/warp \
      --add-flags "$out/lib/warp/index.js"

    runHook postInstall
  '';

  meta = {
    description = "Cloudflare WARP device registration tool for mihomo";
    homepage = "https://github.com/9bingyin/warp";
    license = lib.licenses.mit;
    mainProgram = "warp";
  };
}
