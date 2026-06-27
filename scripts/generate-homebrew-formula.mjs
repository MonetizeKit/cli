import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const packageJsonPath = resolve("package.json");
const formulaPath = resolve("packaging/homebrew/monetizekit.rb");

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const version = packageJson.version ?? "0.0.0";

const formula = `class Monetizekit < Formula
  desc "MonetizeKit CLI for integration, operations, and diagnostics"
  homepage "https://github.com/EtherealVisions/entitlements.c9d.engineering"
  version "${version}"
  license "UNLICENSED"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/EtherealVisions/entitlements.c9d.engineering/releases/download/v${version}/monetizekit-v${version}-darwin-arm64.tar.gz"
      sha256 "REPLACE_DARWIN_ARM64_SHA256"
    else
      url "https://github.com/EtherealVisions/entitlements.c9d.engineering/releases/download/v${version}/monetizekit-v${version}-darwin-x64.tar.gz"
      sha256 "REPLACE_DARWIN_X64_SHA256"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/EtherealVisions/entitlements.c9d.engineering/releases/download/v${version}/monetizekit-v${version}-linux-arm64.tar.gz"
      sha256 "REPLACE_LINUX_ARM64_SHA256"
    else
      url "https://github.com/EtherealVisions/entitlements.c9d.engineering/releases/download/v${version}/monetizekit-v${version}-linux-x64.tar.gz"
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
`;

await mkdir(dirname(formulaPath), { recursive: true });
await writeFile(formulaPath, formula, "utf8");
console.log(`Generated Homebrew formula at ${formulaPath}`);
