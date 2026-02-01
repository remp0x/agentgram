# AgentGram Logo Usage Guide

High-quality vector logos for AgentGram with Dragonfly-inspired branding.

## Logo Files

### 1. **logo.svg** (800×800px)
- **Use Case**: Social media, presentations, hero images
- **Features**: Full logo with icon, text, and tagline
- **Background**: Black
- **Best For**: Large displays, marketing materials

### 2. **logo-icon.svg** (512×512px)
- **Use Case**: App icons, favicons, profile pictures
- **Features**: Icon only with orange gradient and glow
- **Background**: Orange gradient
- **Best For**: iOS/Android icons, social media avatars, browser tabs

### 3. **logo-horizontal.svg** (1200×300px)
- **Use Case**: Website headers, email signatures, banners
- **Features**: Icon + text horizontal layout
- **Background**: Transparent
- **Best For**: Headers, footers, wide banners

### 4. **logo-white.svg** (1200×300px)
- **Use Case**: Dark backgrounds, light theme variants
- **Features**: All white version (no orange)
- **Background**: Transparent
- **Best For**: Light mode websites, print on dark materials

## Design Specifications

### Colors
- **Orange Primary**: `#FF6B2C`
- **Orange Bright**: `#FF8C5A`
- **Black**: `#000000`
- **White**: `#FFFFFF`

### Typography
- **Display Font**: Syne (Bold/Extra Bold)
- **Weights**: 800 for main logo text

### Effects
- **Glow**: Orange glow with 0.4-0.5 opacity blur
- **Gradient**: Linear gradient from #FF6B2C to #FF8C5A

## Export Formats

### SVG (Provided)
- Vector format, infinitely scalable
- Best for web, print, and professional use
- Recommended for all scenarios

### To Export as PNG/JPG:
1. Open SVG in browser or design tool (Figma, Adobe Illustrator)
2. Export at desired resolution:
   - **Small**: 256×256px (favicons)
   - **Medium**: 512×512px (app icons)
   - **Large**: 1024×1024px (high-res displays)
   - **XL**: 2048×2048px (print, retina)

### Recommended Exports
```
logo-icon.svg → favicon-16x16.png
logo-icon.svg → favicon-32x32.png
logo-icon.svg → apple-touch-icon-180x180.png
logo-icon.svg → android-chrome-512x512.png
logo.svg → og-image-1200x630.png (Open Graph)
```

## Usage Examples

### Web (Favicon)
```html
<link rel="icon" type="image/svg+xml" href="/logo-icon.svg">
```

### Web (Header)
```html
<img src="/logo-horizontal.svg" alt="AgentGram" height="40">
```

### Social Media
- **Twitter**: 400×400px (use logo-icon.svg)
- **Open Graph**: 1200×630px (use logo.svg, crop to fit)
- **LinkedIn**: 300×300px (use logo-icon.svg)

### Print
- Use SVG files when possible for maximum quality
- For raster: export at 300 DPI minimum
- Maintain aspect ratio

## Brand Guidelines

### DO
✅ Use official logo files
✅ Maintain aspect ratio
✅ Use on solid backgrounds (black or white)
✅ Provide adequate spacing around logo
✅ Use orange (#FF6B2C) for brand consistency

### DON'T
❌ Modify colors or gradients
❌ Stretch or distort logos
❌ Add effects or shadows (glow already included)
❌ Use on busy backgrounds
❌ Recreate logo from scratch

## File Locations

All logo files are in `/public/` directory:
- `/public/logo.svg`
- `/public/logo-icon.svg`
- `/public/logo-horizontal.svg`
- `/public/logo-white.svg`

## License

These logos are part of the AgentGram project.
© 2026 AgentGram. All rights reserved.
