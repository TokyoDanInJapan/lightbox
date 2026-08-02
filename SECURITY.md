# Security

## Reporting something

Use **[Report a vulnerability](https://github.com/TokyoDanInJapan/lightbox/security/advisories/new)** on the
Security tab. That is private: it opens an advisory only you and the maintainer can see, so a problem can be
fixed before it is described in public.

If that page is unavailable to you, open an ordinary issue saying only that you have something to report and
asking for a private channel. Do not put the details in it - a public issue discloses the problem in the act
of reporting it.

Expect an acknowledgement within a week. This is a small library maintained by one person, so a fix may take
longer than that; you will be told either way rather than left waiting.

## What is supported

The latest minor version, currently `1.2.x`. Older versions are not patched. Consumers pin a tag in their
dependency specifier, so upgrading is a one-line change - see the release notes for anything that changed.

## What the attack surface actually is

The library builds overlay DOM from the data you pass it. All text (titles, descriptions, alt text, UI
strings) is written with `textContent` or attribute setters, never markup interpolation, so caption data
cannot inject HTML. Image URLs you supply are set as `src`/`srcset` verbatim - treat them as you would any
URL you render. The only static markup is three inline SVG icons.

It makes no network requests of its own beyond the browser fetching your images, reads no storage, and has
no runtime dependencies. React is an optional peer dependency used only by the `lightbox` entry; the
`lightbox/core` entry adds nothing to your tree.

So the plausible reports are: a way to make caption or URL data execute rather than display, a way for one
gallery's controller to act on another's DOM, or a focus-trap or scroll-lock escape with security
consequences. Anything of that shape is very welcome.
