/**
 * Stylelint config for the Moshtty renderer.
 *
 * The point of this config is the token contract — every color, spacing,
 * radius, font-size, line-height, z-index, duration, easing, and elevation
 * value in renderer CSS must reference a custom property from
 * `src/renderer/src/design/tokens.css`. The token files themselves are
 * exempt because they are the source of truth.
 *
 * See `docs/moshtty-design-system.md` and the M5 task brief for the rules
 * this config enforces.
 */
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    /* Token contract: only var(...) is allowed for these properties. */
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'background-color',
        'background',
        'fill',
        'stroke',
        'border-color',
        'outline-color',
        '/^padding/',
        '/^margin/',
        '/^gap/',
        'border-radius',
        'border-top-left-radius',
        'border-top-right-radius',
        'border-bottom-left-radius',
        'border-bottom-right-radius',
        'font-size',
        'line-height',
        'z-index',
        'transition-duration',
        'transition-timing-function',
        'animation-duration',
        'animation-timing-function',
        'box-shadow'
      ],
      {
        ignoreValues: [
          /* Allow CSS keywords that aren't styling magic. */
          'auto',
          'inherit',
          'initial',
          'unset',
          'currentColor',
          'transparent',
          'none',
          '0',
          '100%'
        ],
        disableFix: true
      }
    ],

    /* Hard ban on raw px / em / rem values in renderer CSS — use tokens. */
    'declaration-property-value-disallowed-list': [
      {
        '/.*color$/': ['/^#/', '/^rgb/', '/^hsl/'],
        '/^padding/': ['/\\d+(px|em|rem)$/'],
        '/^margin/': ['/\\d+(px|em|rem)$/'],
        '/^gap/': ['/\\d+(px|em|rem)$/'],
        'font-size': ['/\\d+(px|em|rem)$/'],
        'line-height': ['/^\\d+(\\.\\d+)?$/'],
        'border-radius': ['/\\d+(px|em|rem)$/'],
        'transition-duration': ['/^\\d+(ms|s)$/'],
        'animation-duration': ['/^\\d+(ms|s)$/']
      },
      {
        message:
          'Use a design token from src/renderer/src/design/tokens.css instead of a literal value.'
      }
    ],

    /* `!important` should be rare; the only sanctioned use is the
       reduced-motion override inside tokens.css. */
    'declaration-no-important': true,

    'value-keyword-case': [
      'lower',
      {
        ignoreKeywords: ['optimizeLegibility', 'currentColor'],
        ignoreProperties: ['/^--font-family/']
      }
    ],

    'import-notation': 'string',

    'no-descending-specificity': null,

    /* Stylelint Standard's class pattern is fine for kebab-case CSS Modules. */
    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9-]*$',
      { message: 'Class names should be camelCase or kebab-case.' }
    ]
  },
  overrides: [
    {
      files: ['src/renderer/src/design/tokens.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
        'declaration-property-value-disallowed-list': null,
        'value-keyword-case': null,
        'declaration-no-important': null,
        'custom-property-empty-line-before': null,
        'color-function-notation': null,
        'alpha-value-notation': null,
        'color-hex-length': null
      }
    },
    {
      /* Legacy pre-token renderer CSS. M5 migrates these into token-only
         CSS modules under `src/renderer/src/components/**`; until that
         lands, hold the line by exempting only these specific files. */
      files: ['src/renderer/src/assets/main.css', 'src/renderer/src/assets/base.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
        'declaration-property-value-disallowed-list': null,
        'declaration-no-important': null,
        'no-descending-specificity': null,
        'no-duplicate-selectors': null,
        'color-hex-length': null,
        'color-function-notation': null,
        'alpha-value-notation': null,
        'custom-property-empty-line-before': null,
        'shorthand-property-no-redundant-values': null,
        'value-keyword-case': null
      }
    }
  ]
}
