# HereToo memoir render worker.
#
# Toolchain: Pandoc orchestrates LuaLaTeX (memoir.cls) to produce the
# interior + cover PDFs; Ghostscript converts the interior to
# PDF/X-1a:2001 (KDP's preferred print profile); poppler-utils reads
# the page count for spine-width math.
#
# Engine note: LuaLaTeX (not XeLaTeX) because the brand fonts ship as
# variable TTFs and luaotfload handles those reliably; xelatex's
# variable-font support is patchy. Libertinus is installed as a
# guaranteed fallback (see template.tex) so a render never hard-fails
# on a missing/odd font.
#
# Fonts (all OFL): Source Serif 4 (body), Inter (sans), Syne (display)
# are pulled from the Google Fonts repo at build time so the repo
# stays light and the build is reproducible.

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# TeX + Pandoc + Ghostscript + poppler + fontconfig + Node 20.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg \
      pandoc \
      texlive-luatex \
      texlive-xetex \
      texlive-fonts-recommended \
      texlive-fonts-extra \
      texlive-latex-extra \
      texlive-latex-recommended \
      ghostscript \
      poppler-utils \
      fontconfig \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Fonts. Each face dropped into /usr/share/fonts then registered.
RUN mkdir -p /usr/share/fonts/truetype/heretoo \
 && cd /usr/share/fonts/truetype/heretoo \
 && BASE="https://raw.githubusercontent.com/google/fonts/main" \
 && for f in \
      "ofl/sourceserif4/SourceSerif4%5Bopsz%2Cwght%5D.ttf" \
      "ofl/sourceserif4/SourceSerif4-Italic%5Bopsz%2Cwght%5D.ttf" \
      "ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf" \
      "ofl/syne/Syne%5Bwght%5D.ttf" ; do \
        curl -fsSL "$BASE/$f" -o "$(basename "$f" | sed 's/%5B.*//; s/$/.ttf/')" || true ; \
    done \
 && fc-cache -f

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src

ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/server.js"]
