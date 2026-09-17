<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title><xsl:value-of select="/rss/channel/title"/></title>
<link rel="icon" href="/fsot/icon.png"/>
<link rel="stylesheet" href="/fsot/fonts.css"/>
<link rel="stylesheet" href="/fsot/style.css"/>
</head>
<body>
<div class="wrap">
<header class="site">
<a class="back" href="https://heretoo.social/">&#8592; HereToo</a>
<a class="brand" href="/fsot/">FSOT &amp; OMST Prep</a>
</header>
<nav class="crumbs"><a href="/fsot/">FSOT</a> / <a href="/fsot/listen/">Audio course</a> / Feed</nav>
<h1><xsl:value-of select="/rss/channel/title"/></h1>
<p class="lede">This page is a podcast feed. Add it to a podcast app with the button below,
or <a href="/fsot/listen/">play the episodes here</a>.</p>
<p><a class="btn" href="/fsot/subscribe/">How to subscribe</a></p>
<h2>Episodes</h2>
<ul class="toc">
<xsl:for-each select="/rss/channel/item">
<li>
<a>
<xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
<span class="t"><xsl:value-of select="title"/></span><br/>
<span class="d"><xsl:value-of select="description"/></span>
</a>
</li>
</xsl:for-each>
</ul>
<footer class="site">
<p><a href="https://heretoo.social/">HereToo</a> &#183; <a href="/fsot/guide/">Study guide</a> &#183;
<a href="/fsot/listen/">Audio course</a> &#183; <a href="/fsot/subscribe/">Subscribe</a></p>
</footer>
</div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
