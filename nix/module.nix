{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.mihomo-warp;
  stateDir = "/var/lib/mihomo-warp";
  configFile = "${stateDir}/config.yaml";
  needsPrivilegedPort = cfg.port < 1024;

  registerArgs =
    [
      "register"
      cfg.mode
      "-o"
      configFile
      "--listen"
      cfg.listen
      "--port"
      (toString cfg.port)
      "--dns"
      cfg.dns
    ]
    ++ lib.optionals (cfg.deviceName != null) [
      "--name"
      cfg.deviceName
    ];

  registerScript = pkgs.writeShellScript "mihomo-warp-register" ''
    set -euo pipefail
    args=(${lib.escapeShellArgs registerArgs})
    if [ -n "''${WARP_JWT:-}" ]; then
      args+=(--jwt "$WARP_JWT")
    fi
    if [ -n "''${SOCKS_USER:-}" ] && [ -n "''${SOCKS_PASS:-}" ]; then
      args+=(--username "$SOCKS_USER" --password "$SOCKS_PASS")
    fi
    ${cfg.package}/bin/warp "''${args[@]}"
  '';

  commonHardening = {
    LockPersonality = true;
    NoNewPrivileges = true;
    PrivateDevices = true;
    PrivateTmp = true;
    ProtectClock = true;
    ProtectControlGroups = true;
    ProtectHome = true;
    ProtectHostname = true;
    ProtectKernelLogs = true;
    ProtectKernelModules = true;
    ProtectKernelTunables = true;
    ProtectSystem = "strict";
    ReadWritePaths = [ stateDir ];
    RestrictNamespaces = true;
    RestrictRealtime = true;
    RestrictSUIDSGID = true;
  };
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
    users.users.mihomo-warp = {
      isSystemUser = true;
      group = "mihomo-warp";
    };
    users.groups.mihomo-warp = { };

    systemd.services.mihomo-warp-register = {
      description = "Cloudflare WARP Device Registration";
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      requiredBy = [ "mihomo-warp.service" ];
      before = [ "mihomo-warp.service" ];

      unitConfig = {
        ConditionPathExists = "!${configFile}";
      };

      serviceConfig = commonHardening // {
        Type = "oneshot";
        RemainAfterExit = true;
        User = "mihomo-warp";
        Group = "mihomo-warp";
        StateDirectory = "mihomo-warp";
        ExecStart = registerScript;
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;
        CapabilityBoundingSet = "";
      };
    };

    systemd.services.mihomo-warp = {
      description = "Cloudflare WARP Proxy (mihomo)";
      after = [
        "network-online.target"
        "mihomo-warp-register.service"
      ];
      wants = [ "network-online.target" ];
      requires = [ "mihomo-warp-register.service" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = commonHardening // {
        Type = "simple";
        User = "mihomo-warp";
        Group = "mihomo-warp";
        StateDirectory = "mihomo-warp";
        ExecStart = "${cfg.mihomoPackage}/bin/mihomo -d ${stateDir}";
        Restart = "on-failure";
        RestartSec = 5;
        CapabilityBoundingSet = lib.optionals needsPrivilegedPort [ "CAP_NET_BIND_SERVICE" ];
        AmbientCapabilities = lib.optionals needsPrivilegedPort [ "CAP_NET_BIND_SERVICE" ];
      };
    };
  };
}
