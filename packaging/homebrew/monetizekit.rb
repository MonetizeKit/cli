class Monetizekit < Formula
  desc "MonetizeKit CLI for integration, operations, and diagnostics"
  homepage "https://github.com/EtherealVisions/entitlements.c9d.engineering"
  version "0.1.0"
  license "UNLICENSED"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/EtherealVisions/entitlements.c9d.engineering/releases/download/v0.1.0/monetizekit-v0.1.0-darwin-arm64.tar.gz"
      sha256 "REPLACE_DARWIN_ARM64_SHA256"
    else
      url "https://github.com/EtherealVisions/entitlements.c9d.engineering/releases/download/v0.1.0/monetizekit-v0.1.0-darwin-x64.tar.gz"
      sha256 "REPLACE_DARWIN_X64_SHA256"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/EtherealVisions/entitlements.c9d.engineering/releases/download/v0.1.0/monetizekit-v0.1.0-linux-arm64.tar.gz"
      sha256 "REPLACE_LINUX_ARM64_SHA256"
    else
      url "https://github.com/EtherealVisions/entitlements.c9d.engineering/releases/download/v0.1.0/monetizekit-v0.1.0-linux-x64.tar.gz"
      sha256 "REPLACE_LINUX_X64_SHA256"
    end
  end

  def install
    bin.install "bin/monetizekit"
    bin.install_symlink bin/"monetizekit" => "mk"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/monetizekit version --json")
  end
end
