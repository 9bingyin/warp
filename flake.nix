{
  description = "Cloudflare WARP device registration tool for mihomo";

  nixConfig = {
    extra-substituters = [ "https://cache.garnix.io" ];
    extra-trusted-public-keys = [ "cache.garnix.io:CTFPyKSLcx5RMJKfLo5EEPUObbA78b0YQ2DTCJXqr9g=" ];
  };

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          mihomoWarp = pkgs.callPackage ./nix/package.nix { };
        in
        {
          default = mihomoWarp;
          "mihomo-warp" = mihomoWarp;
        }
      );

      nixosModules = {
        default = self.nixosModules."mihomo-warp";
        "mihomo-warp" =
          { pkgs, ... }:
          {
            imports = [ ./nix/module.nix ];
            services.mihomo-warp.package = nixpkgs.lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}."mihomo-warp";
          };
      };
    };
}
