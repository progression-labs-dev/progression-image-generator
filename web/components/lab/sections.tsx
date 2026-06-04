"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PAL, FIELD, BRAND_SWATCHES, ASCII_CHARSET, type RGB, type Palette } from "@/lib/palettes";
import { multiStopGradientColor, multiStopGradientColorRGB } from "@/lib/render";
import { useLab } from "./lab-context";
import { Row, SliderRow, SwitchRow, ToggleRow, SelectRow } from "./controls";
import { ColorRow } from "./ColorSwatchPopover";
import { GradientEditor } from "./GradientEditor";

const FIELD_SWATCHES = [
  { name: "Blue", rgb: FIELD.blue },
  { name: "Navy", rgb: FIELD.navy },
  { name: "Orange", rgb: FIELD.orange },
  { name: "Cream", rgb: FIELD.cream },
];

export function gradientCss(pal: Palette): string {
  const n = 24;
  const parts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const br = (i / n) * 255;
    const [r, g, b] =
      pal.interp === "rgb"
        ? multiStopGradientColorRGB(br, pal.stops)
        : multiStopGradientColor(br, pal.stops);
    parts.push(`rgb(${r},${g},${b}) ${((i / n) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${parts.join(",")})`;
}

function Section({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="border-border">
      <AccordionTrigger className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide hover:no-underline">
        {title}
      </AccordionTrigger>
      <AccordionContent className="space-y-4 px-4 pb-4 pt-1">{children}</AccordionContent>
    </AccordionItem>
  );
}

export function PixelationSection() {
  const { params } = useLab();
  return (
    <Section value="pixelation" title="Pixelation">
      <SliderRow
        k="cellSize"
        label="Cell size"
        hint="Master granularity. Block = cellSize×2; circle radius = cellSize. Drives font size, blob radius and the grid stride."
        min={4}
        max={40}
        fmt={(v) => `${v}px`}
      />
      <SliderRow
        k="spacing"
        label="Spacing"
        hint="Gap between cells. step = cellSize×2 + spacing. 0 = solid mosaic (matches the deck look)."
        min={0}
        max={40}
        fmt={(v) => `${v}px`}
      />
      <ToggleRow
        k="shape"
        label="Shape"
        hint="pixel = flat block; circle = convex sphere with a radial highlight."
        options={[
          { value: "pixel", label: "Pixel" },
          { value: "circle", label: "Circle" },
        ]}
      />
      <SwitchRow
        k="jitterEnabled"
        label="Column jitter"
        hint="Per-column vertical wobble of the SAMPLE point to break up banding (mosaic only; off for the deck look)."
      />
      {params.jitterEnabled && (
        <SliderRow
          k="jitterMagnitude"
          label="Jitter amount"
          min={0}
          max={0.2}
          step={0.005}
          fmt={(v) => v.toFixed(3)}
        />
      )}
    </Section>
  );
}

export function RegionSection() {
  const { params } = useLab();
  const isSolid = params.direction === "solid";
  const splitOn = params.splitEnabled || params.direction === "split";
  const bgSolid = params.backgroundMode === "solid";
  return (
    <Section value="region" title="Region">
      <ToggleRow
        k="direction"
        label="Apply effect to"
        hint="Subject / Surroundings need a subject mask (Remove background). Whole = the entire frame. Solid replaces the background with a flat colour."
        options={[
          { value: "subject", label: "Subject" },
          { value: "surroundings", label: "Around" },
          { value: "all", label: "Whole" },
          { value: "solid", label: "Solid" },
        ]}
      />
      {!isSolid && (
        <SwitchRow
          k="splitEnabled"
          label="Split half & half"
          hint="Dissolve only ONE side of a line — combined with the region above. E.g. Subject + Split = sharp half / dissolved half of the subject, background untouched."
        />
      )}
      {!isSolid && splitOn && (
        <>
          <SliderRow
            k="splitPosition"
            label="Split position"
            min={0}
            max={1}
            step={0.01}
            fmt={(v) => v.toFixed(2)}
          />
          <SliderRow
            k="splitAngle"
            label="Split angle"
            hint="0° = vertical (left/right) · 90° = horizontal (top/bottom). Add 180° to flip which side dissolves."
            min={0}
            max={360}
            fmt={(v) => `${v}°`}
          />
          <SliderRow
            k="boundaryFeather"
            label="Edge feather"
            hint="Soften the split into a scattered, organic dissolve instead of a hard line. 0 = hard edge."
            min={0}
            max={1}
            step={0.01}
            fmt={(v) => (v === 0 ? "hard" : v.toFixed(2))}
          />
        </>
      )}
      {!isSolid && (
        <ToggleRow
          k="backgroundMode"
          label="Background"
          hint="What to do with everything outside the subject. Photo = keep the original scene; Cut out = remove it (transparent — just the subject); Solid = flat colour. Cut out / Solid need a subject mask — click Remove background first."
          options={[
            { value: "photo", label: "Photo" },
            { value: "transparent", label: "Cut out" },
            { value: "solid", label: "Solid" },
          ]}
        />
      )}
      {(isSolid || bgSolid) && (
        <ColorRow
          k="solidColor"
          label="Field colour"
          hint="Flat background colour behind the subject (every.to look)."
          swatches={FIELD_SWATCHES}
        />
      )}
    </Section>
  );
}

function PalettePicker() {
  const { params, patch } = useLab();
  const pal = params.palette;
  const currentName =
    Object.keys(PAL).find(
      (n) => JSON.stringify(PAL[n].stops) === JSON.stringify(pal.stops) && PAL[n].interp === pal.interp,
    ) ?? "custom";
  return (
    <div className="space-y-2">
      <Row label="Palette">
        <Select
          value={currentName}
          onValueChange={(name) => {
            if (name && name !== "custom" && PAL[name])
              patch({ palette: { interp: PAL[name].interp, stops: PAL[name].stops.map((s) => [...s] as RGB) } });
          }}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(PAL).map((n) => (
              <SelectItem key={n} value={n} className="text-xs capitalize">
                {n}
              </SelectItem>
            ))}
            {currentName === "custom" && (
              <SelectItem value="custom" className="text-xs">
                Custom
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </Row>
      <div
        className="h-6 w-full rounded-md ring-1 ring-inset ring-white/10"
        style={{ background: gradientCss(pal) }}
        aria-label="gradient preview"
      />
      <GradientEditor />
    </div>
  );
}

export function ColourSection() {
  const { params } = useLab();
  const isMosaic = params.engine === "mosaic";
  return (
    <Section value="colour" title="Colour">
      {isMosaic && (
        <ToggleRow
          k="colorMode"
          label="Pixel colour"
          hint="Photo = keep the photo’s own colours. Custom = recolour the pixels through your palette below."
          options={[
            { value: "original", label: "Photo" },
            { value: "gradient", label: "Custom palette" },
          ]}
        />
      )}
      {isMosaic && params.colorMode === "gradient" && <PalettePicker />}
      {isMosaic && params.colorMode === "original" && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Pixels use the photo’s own colours. Switch to <b>Custom palette</b> to colour them blue /
          orange / white etc.
        </p>
      )}
      {!isMosaic && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          The deck engine keeps the photo greyscale and colours it through the ASCII tint + watercolor
          blobs — set that colour in the <b>ASCII</b> section.
        </p>
      )}
      <p className="text-[10px] leading-snug text-muted-foreground">
        ASCII glyph colour is set separately in the <b>ASCII</b> section (white / brand / custom).
      </p>
    </Section>
  );
}

const CHARSET_PRESETS: { name: string; chars: string }[] = [
  { name: "Full", chars: ASCII_CHARSET },
  { name: "Letters", chars: "PROGRESSIONLABS" },
  { name: "Digits", chars: "0123456789" },
  { name: "Binary", chars: "01" },
  { name: "Symbols", chars: "@#$%&*+=?<>{}[]/\\|" },
  { name: "Blocks", chars: "█▓▒░" },
  { name: "LABS", chars: "LABS" },
];

function CharsetRow() {
  const { params, set } = useLab();
  return (
    <Row
      label="Characters"
      hint="The glyphs the ASCII layer draws from (one picked per cell). Type your own set, or tap a preset. Keep ‘Vary glyphs’ on so the whole set actually shows."
    >
      <div className="space-y-2">
        <Input
          value={params.asciiCharset}
          onChange={(e) => set("asciiCharset", e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder={ASCII_CHARSET}
          className="h-8 font-mono text-xs"
        />
        <div className="flex flex-wrap gap-1">
          {CHARSET_PRESETS.map((c) => (
            <Button
              key={c.name}
              type="button"
              size="sm"
              variant={params.asciiCharset === c.chars ? "default" : "outline"}
              className="h-6 px-2 text-[10px]"
              onClick={() => set("asciiCharset", c.chars)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </div>
    </Row>
  );
}

export function AsciiSection() {
  const { params } = useLab();
  const ramp = params.asciiArt && params.asciiGlyphMode === "ramp";
  return (
    <Section value="ascii" title="ASCII">
      <SwitchRow k="ascii" label="ASCII overlay" hint="Stamp glyphs into the cells." />
      <SwitchRow
        k="asciiArt"
        label="ASCII art (glyphs form the subject)"
        hint="Dense text glyphs replace the blocks — the subject becomes text (refs #2–#5). Pair with a mask + 'ASCII only' placement."
      />
      {params.asciiArt && (
        <>
          <ToggleRow
            k="asciiGlyphMode"
            label="Glyph mode"
            hint="Tinted = position-seeded letters coloured by the image (#2–#4); Ramp = glyph chosen by luminance (#5)."
            options={[
              { value: "random", label: "Tinted letters" },
              { value: "ramp", label: "Tone ramp" },
            ]}
          />
          {params.asciiGlyphMode === "ramp" && (
            <SelectRow
              k="asciiRamp"
              label="Ramp"
              hint="Dark→light glyph ramp used to pick each character by brightness."
              options={[
                { value: "@%#*+=-:. ", label: "Classic" },
                { value: "█▓▒░ ", label: "Blocks" },
                { value: "@#WMZOoc:. ", label: "Heavy" },
              ]}
            />
          )}
          <ToggleRow
            k="asciiBackground"
            label="Background"
            hint="Scene = keep the source behind the glyphs (overlay / collage); Solid = flat field (set the colour in Region › Solid)."
            options={[
              { value: "scene", label: "Scene" },
              { value: "solid", label: "Solid field" },
            ]}
          />
        </>
      )}
      {(params.ascii || params.asciiArt) && (
        <>
          <SliderRow
            k="asciiDensity"
            label="Density"
            hint="Fraction of cells that get a glyph (deterministic hash gate). 0 = none, 1 = every cell."
            min={0}
            max={1}
            step={0.01}
            fmt={(v) => v.toFixed(2)}
          />
          {!ramp && (
            <>
              <CharsetRow />
              <SwitchRow
                k="asciiGlyphScatter"
                label="Vary glyphs"
                hint="Spread the picks across the WHOLE character set. Off = the legacy repeating pattern, which on a regular grid often collapses to just 1–2 glyphs (the ‘0 / +’ look)."
              />
            </>
          )}
          <SelectRow
            k="asciiPlacement"
            label="Placement"
            hint="in-pixel = glyph on the block; ascii-only = no blocks, pure characters; separate-grid = glyphs on their own stride; between = in the gutters (needs spacing); deck-tint = deck colouring."
            options={[
              { value: "in-pixel", label: "In pixel" },
              { value: "ascii-only", label: "ASCII only (no blocks)" },
              { value: "separate-grid", label: "Separate grid" },
              { value: "between", label: "Between pixels" },
              { value: "deck-tint", label: "Deck tint" },
            ]}
          />
          {params.asciiPlacement === "separate-grid" && (
            <SliderRow
              k="asciiGridScale"
              label="ASCII grid scale"
              hint="Stride of the glyph grid relative to the pixel grid. >1 = sparser, <1 = denser."
              min={0.25}
              max={4}
              step={0.05}
              fmt={(v) => `${v.toFixed(2)}×`}
            />
          )}
          <ToggleRow
            k="asciiInk"
            label="ASCII colour"
            hint="White, Brand (palette mid-stop), Custom, or Source (each glyph takes the image colour under it — the tinted-letters look)."
            options={[
              { value: "white", label: "White" },
              { value: "brand", label: "Brand" },
              { value: "custom", label: "Custom" },
              { value: "source", label: "Source" },
            ]}
          />
          {(params.asciiInk === "custom" || params.engine === "deck") && (
            <ColorRow
              k="asciiInkCustom"
              label="Custom ASCII / tint colour"
              hint="The ASCII glyph colour (when ‘Custom’) and the deck brand tint."
              swatches={BRAND_SWATCHES}
            />
          )}
          <ToggleRow
            k="asciiOpacityModel"
            label="Opacity model"
            hint="constant = same alpha everywhere (mosaic); fade = dense at top → faint at bottom (deck)."
            options={[
              { value: "constant", label: "Constant" },
              { value: "fade", label: "Top→bottom fade" },
            ]}
          />
          {params.asciiOpacityModel === "constant" ? (
            <SliderRow
              k="asciiOpacity"
              label="Opacity"
              min={0}
              max={1}
              step={0.01}
              fmt={(v) => v.toFixed(2)}
            />
          ) : (
            <>
              <SliderRow k="asciiFadeTop" label="Fade top" min={0} max={1} step={0.01} fmt={(v) => v.toFixed(2)} />
              <SliderRow
                k="asciiFadeBottom"
                label="Fade bottom"
                min={0}
                max={1}
                step={0.01}
                fmt={(v) => v.toFixed(2)}
              />
              <SliderRow k="asciiFadeSlope" label="Fade slope" min={0} max={1.5} step={0.01} fmt={(v) => v.toFixed(2)} />
            </>
          )}
          <SelectRow
            k="asciiBlend"
            label="Blend"
            hint="overlay = mosaic look; source-over = deck look; screen = brighter glow."
            options={[
              { value: "overlay", label: "Overlay" },
              { value: "source-over", label: "Source-over" },
              { value: "screen", label: "Screen" },
            ]}
          />
          <SliderRow
            k="fontSizeMul"
            label="Glyph size"
            hint="Font size = max(min, cellSize × this). Default 1.6."
            min={0.8}
            max={2.5}
            step={0.05}
            fmt={(v) => `${v.toFixed(2)}×`}
          />
        </>
      )}
    </Section>
  );
}

export function TextureSection() {
  const { params } = useLab();
  return (
    <Section value="texture" title="Texture">
      <SliderRow
        k="brightnessCutoff"
        label="Brightness cutoff"
        hint="Skip cells darker than this (deck frosts only highlights). 0 disables."
        min={0}
        max={255}
        fmt={(v) => (v === 0 ? "off" : String(v))}
      />
      <SwitchRow
        k="watercolorBlobs"
        label="Watercolor blobs"
        hint="Tint clusters of blocks toward the ink colour (deck post-pass)."
      />
      {params.watercolorBlobs && (
        <>
          <SliderRow k="blobCountMin" label="Blobs min" min={0} max={10} />
          <SliderRow k="blobCountMax" label="Blobs max" min={0} max={12} />
          <SliderRow
            k="blobRadiusMul"
            label="Blob radius"
            hint="Influence radius = cellSize × this."
            min={2}
            max={20}
            fmt={(v) => `${v}×`}
          />
          <SliderRow k="blobTintScale" label="Blob tint" min={0} max={1} step={0.01} fmt={(v) => v.toFixed(2)} />
        </>
      )}
      <SliderRow
        k="grainOpacity"
        label="Film grain"
        hint="Overlay-blended monochrome noise. 0 disables."
        min={0}
        max={0.3}
        step={0.01}
        fmt={(v) => (v === 0 ? "off" : v.toFixed(2))}
      />
      {(params.watercolorBlobs || params.grainOpacity > 0) && (
        <SliderRow
          k="seed"
          label="Seed"
          hint="Random seed for blobs + grain. Same seed → identical render."
          min={1}
          max={9999}
        />
      )}
    </Section>
  );
}
