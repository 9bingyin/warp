{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.mihomo-warp;
in
{
  options.services.mihomo-warp = {
    enable = lib.mkEnableOption "Cloudflare WARP proxy";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix { };
      description = "The warp package to use.";
    };

    mihomoPackage = lib.mkPackageOption pkgs "mihomo" { };

    mode = lib.mkOption {
      type = lib.types.enum [
        "masque"
        "wireguard"
      ];
      default = "masque";
      description = "WARP registration mode.";
    };

    listen = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = "SOCKS5 listener bind address.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 1080;
      description = "SOCKS5 listener port.";
    };

    dns = lib.mkOption {
      type = lib.types.str;
      default = "1.1.1.1,1.0.0.1";
      description = "Comma-separated DNS servers.";
    };

    deviceName = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "Device name for registration (masque mode only).";
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      description = ''
        Path to an environment file loaded by the systemd service.
        Supports the following variables:
        - WARP_JWT: ZeroTrust JWT token
        - SOCKS_USER: SOCKS5 authentication username
        - SOCKS_PASS: SOCKS5 authentication password
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.mihomo-warp = {
      description = "Cloudflare WARP Proxy";
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        Type = "simple";
        StateDirectory = "mihomo-warp";
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;

        ExecStartPre =
          let
            registerScript = pkgs.writeShellScript "mihomo-warp-register" ''
              CONFIG_FILE="/var/lib/mihomo-warp/config.yaml"
              if [ ! -f "$CONFIG_FILE" ]; then
                echo "config not found, starting registration..."
                ARGS="register ${cfg.mode} -o $CONFIG_FILE"
                ARGS="$ARGS --listen ${cfg.listen}"
                ARGS="$ARGS --port ${toString cfg.port}"
                ARGS="$ARGS --dns ${cfg.dns}"
                ${lib.optionalString (cfg.deviceName != null) ''
                  ARGS="$ARGS --name ${lib.escapeShellArg cfg.deviceName}"
                ''}
                if [ -n "''${WARP_JWT:-}" ]; then
                  ARGS="$ARGS --jwt $WARP_JWT"
                fi
                if [ -n "''${SOCKS_USER:-}" ] && [ -n "''${SOCKS_PASS:-}" ]; then
                  ARGS="$ARGS --username $SOCKS_USER --password $SOCKS_PASS"
                fi
                ${cfg.package}/bin/warp $ARGS
                echo "registration successful: $CONFIG_FILE"
              else
                echo "config exists: $CONFIG_FILE"
              fi
            '';
          in
          "+${registerScript}";

        ExecStart = "${cfg.mihomoPackage}/bin/mihomo -d /var/lib/mihomo-warp";
        Restart = "on-failure";
        RestartSec = 5;
      };
    };
  };
}
