<script lang="ts">
  import { getPersona, type PersonaId } from '$lib/personas';
  import { KICKER_VOICE_TAKES } from '$lib/fixtures/voiceTakes';

  interface Feature {
    kicker: string;
    head: string;
    body: string;
  }

  interface PlanTier {
    name: string;
    price: string;
    sub: string;
    features: string[];
    cta: string;
    href: string;
    variant: 'touchline' | 'press-box' | 'print-run';
    badge?: string;
  }

  const features: Feature[] = [
    {
      kicker: 'THE PAPER',
      head: 'A proper broadsheet. Every matchday morning.',
      body: 'Not a dashboard. Not a feed. A full newspaper — lead story, columns, sidebars, pull quotes, and corner ornaments. Looks like 1987. Works like 2026.'
    },
    {
      kicker: 'THE VOICE',
      head: "Ten pundits. One you'll actually like.",
      body: 'Pick from the full cast — Macca, Baz, Rupes, Dessie, Mickey, Uncle Tel, The Gaffer, Bazzer, Coach, and The Voice. Swap any time. Your paper, your pundit.'
    },
    {
      kicker: 'THE MODEL',
      head: 'Real probabilities. No made-up confidence.',
      body: "Five statistical models, eleven thousand simulations per fixture. The numbers are honest. The pundit's commentary is not. That's the product."
    },
    {
      kicker: 'CHEERS GEOFF',
      head: 'Gloriously useless information.',
      body: 'Every edition includes at least one stat so pointless it loops back around to being essential. Mickey delivers them with inappropriate emotional intensity. Bazzer gets them wrong.'
    },
    {
      kicker: 'THE BROADSHEET',
      head: 'Sunday paper. The full thing.',
      body: "Gameweek edition — three-column feature, lead story with drop cap, Geoff's column, the Weekend Board. Suitable for printing. We won't judge you."
    },
    {
      kicker: 'THE CHAT',
      head: 'Ask your pundit anything.',
      body: "The home screen is a conversation. Ask Macca about Liverpool's xG over the last five seasons. Ask Bazzer who won. Ask The Gaffer to explain his answer."
    }
  ];

  const voiceReelIds: PersonaId[] = ['scouser', 'volcano', 'optimist', 'philosopher'];
  const voiceReel = voiceReelIds.map((id) => ({
    persona: getPersona(id),
    take: KICKER_VOICE_TAKES[id]
  }));

  const plans: PlanTier[] = [
    {
      name: 'Touchline',
      price: 'Free',
      sub: 'Forever. No card.',
      features: [
        'One pundit (The Voice)',
        'Daily headline + pick',
        'Fixture cards for all matches',
        '"Cheers, Geoff" of the day',
        'Web only'
      ],
      cta: 'START FREE →',
      href: '/onboarding',
      variant: 'touchline'
    },
    {
      name: 'The Press Box',
      price: '£4',
      sub: 'per month · cancel anytime',
      features: [
        'All 10 pundits, swap any time',
        'Full broadsheet every matchday',
        'Unlimited chat with your pundit',
        "Audio column (your pundit's voice)",
        'Mobile app · archive back to GW1'
      ],
      cta: 'START 7-DAY TRIAL →',
      href: '/onboarding',
      variant: 'press-box',
      badge: 'MOST POPULAR'
    },
    {
      name: 'The Print Run',
      price: '£20',
      sub: 'per month · actually physical',
      features: [
        'Everything in The Press Box',
        'Physical broadsheet posted weekly',
        'Printed on newsprint. Proper ink.',
        'Exclusive "Gaffer\'s Column" insert',
        'Your name in the masthead (small)'
      ],
      cta: 'JOIN THE PRINT RUN →',
      href: '/onboarding',
      variant: 'print-run',
      badge: 'FOR THE COMMITTED'
    }
  ];
</script>

<svelte:head>
  <title>The Kicker — your daily football paper</title>
</svelte:head>

<div class="bg-paper text-ink min-h-screen" data-landing-page>
  <!-- NAV -->
  <nav
    class="px-6 md:px-10 py-4 flex items-center justify-between border-b-2 border-ink"
    data-landing-nav
  >
    <a
      href="/"
      class="font-serif font-bold text-[24px] md:text-[28px] tracking-[-0.02em] text-ink no-underline"
    >
      The Kicker.
    </a>
    <div class="hidden md:flex items-center gap-6 font-sans text-[11px] tracking-[0.2em] font-bold">
      <a href="#pundits" class="text-ink-dim hover:text-ink">PUNDITS</a>
      <a href="#features" class="text-ink-dim hover:text-ink">FEATURES</a>
      <a href="#pricing" class="text-ink-dim hover:text-ink">PRICING</a>
      <a href="/onboarding" class="text-ink border-b border-ink pb-0.5">SIGN IN</a>
      <a
        href="/onboarding"
        class="px-4 py-2 font-sans font-extrabold text-[11px] tracking-[0.15em] bg-ink text-paper no-underline"
        data-landing-cta-nav
      >
        GET STARTED →
      </a>
    </div>
    <a
      href="/onboarding"
      class="md:hidden px-3 py-1.5 font-sans font-extrabold text-[10px] tracking-[0.15em] bg-ink text-paper no-underline"
      data-landing-cta-nav-mobile
    >
      GET STARTED →
    </a>
  </nav>

  <!-- HERO -->
  <section
    class="px-6 md:px-10 pt-10 md:pt-12 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-8 border-b-[3px] border-ink"
    data-landing-hero
  >
    <div class="lg:col-span-8">
      <div class="font-sans text-[10px] tracking-[0.4em] font-bold mb-3 text-red">
        THE PREMIER LEAGUE · YOUR WORDS · EVERY MATCHDAY
      </div>
      <h1
        class="font-serif font-bold text-[48px] md:text-[72px] lg:text-[88px] leading-[0.92] lg:leading-[0.88] tracking-[-0.03em] text-ink"
      >
        Your daily football paper, written by a pundit who
        <em class="not-italic text-[var(--persona-accent,var(--red))] italic">actually has opinions.</em>
      </h1>
      <div class="mt-6 sm:columns-2 sm:gap-6 font-serif text-[14px] leading-[1.65] text-ink">
        <p class="mb-3">
          Pick a voice — Macca's measured Scouse, Mickey's permanent outrage, Coach Beaumont's
          bewildering enthusiasm. Every morning, the Premier League rewritten in the pundit of your
          choosing, with real probability data underneath every take.
        </p>
        <p>
          Ten pundits. One paper. Actual model-backed predictions from five statistical approaches.
          "Cheers, Geoff" moments of gloriously useless information. And a broadsheet that looks
          like a newspaper because it <em>is</em> one, more or less.
        </p>
      </div>
      <div class="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
        <a
          href="/onboarding"
          class="inline-block px-10 py-4 font-sans font-extrabold text-[14px] tracking-[0.1em] bg-ink text-paper no-underline"
          data-landing-cta-hero
        >
          START READING FREE →
        </a>
        <div class="font-serif italic text-[12px] text-ink-dim">
          No card. Pick your pundit. Open your paper.
        </div>
      </div>
    </div>
    <aside class="lg:col-span-4">
      <div class="font-sans text-[9px] tracking-[0.25em] font-bold mb-2 text-red">
        TODAY'S EDITION PREVIEW
      </div>
      <div class="bg-paper-warm border border-ink p-5" data-landing-preview-card>
        <div
          class="font-sans text-[8px] tracking-[0.3em] font-bold pb-2 mb-3 text-red border-b border-ink"
        >
          FIXTURE · ANFIELD · SUN 16:00
        </div>
        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-3">
          <div class="text-right font-serif font-bold text-[20px] leading-none">Liverpool</div>
          <div
            class="text-center font-mono font-extrabold text-[28px] tracking-[-0.04em] leading-none"
          >
            61<span class="text-ink-faint text-[18px]">·21·</span>18
          </div>
          <div class="font-serif font-bold text-[20px] leading-none">Tottenham</div>
        </div>
        <div class="h-1.5 flex mb-3 border border-ink">
          <div class="bg-red" style="width:61%;"></div>
          <div class="bg-ink-faint" style="width:21%;"></div>
          <div class="bg-ink" style="width:18%;"></div>
        </div>
        <p class="font-serif italic text-[12px] leading-[1.4]">
          "To be fair to Spurs — and I will be fair, I always am — there's no answer to Liverpool's
          press. There isn't."
        </p>
        <div class="mt-2 flex items-center justify-between">
          <div class="font-sans text-[9px] tracking-widest font-bold text-ink-dim">
            — MACCA FROM BIRKENHEAD
          </div>
          <div class="font-mono font-bold text-[14px] text-red">2–0</div>
        </div>
      </div>
      <div
        class="mt-3 px-4 py-3 bg-paper-warm border-2 border-dashed border-amber relative"
        data-landing-cheers
      >
        <div
          class="absolute -top-2 left-3 px-2 py-0.5 font-sans text-[7px] tracking-[0.3em] font-extrabold bg-amber text-paper"
        >
          CHEERS, GEOFF
        </div>
        <p class="font-serif italic text-[11px] mt-1">
          Salah has scored in every month with an R in it. <strong>April has an R.</strong> You're welcome.
        </p>
      </div>
    </aside>
  </section>

  <!-- FEATURES -->
  <section
    id="features"
    class="px-6 md:px-10 py-12 border-b-2 border-ink"
    data-landing-features
  >
    <header class="flex items-baseline justify-between mb-6 pb-4 border-b border-ink">
      <h2 class="font-serif font-bold text-[28px] md:text-[38px] tracking-[-0.02em] text-ink">
        What you get
      </h2>
      <div class="font-sans text-[10px] tracking-[0.3em] font-bold text-red hidden sm:block">
        ALL EDITIONS · ALL PUNDITS
      </div>
    </header>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {#each features as feature, i (feature.kicker)}
        <article
          class="pt-4 border-t-2"
          class:border-red={i === 0}
          class:border-ink={i !== 0}
          data-landing-feature
        >
          <div class="font-sans text-[9px] tracking-[0.3em] font-bold mb-1.5 text-red">
            {feature.kicker}
          </div>
          <h3
            class="font-serif font-bold text-[22px] leading-[1.1] tracking-[-0.01em] text-ink"
          >
            {feature.head}
          </h3>
          <p class="mt-2 font-serif text-[13px] leading-[1.55] text-ink-soft">{feature.body}</p>
        </article>
      {/each}
    </div>
  </section>

  <!-- VOICE REEL -->
  <section
    id="pundits"
    class="px-6 md:px-10 py-12 border-b-2 border-ink"
    data-landing-voice-reel
  >
    <header class="flex items-baseline justify-between mb-6 pb-4 border-b border-ink">
      <h2 class="font-serif font-bold text-[28px] md:text-[38px] tracking-[-0.02em] text-ink">
        Four voices. Same Sunday.
      </h2>
      <div class="hidden sm:block font-serif italic text-[12px] text-ink-dim">
        Prompt: "Talk me through Anfield, Sunday."
      </div>
    </header>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {#each voiceReel as { persona, take } (persona.id)}
        <article data-landing-voice data-landing-voice-id={persona.id}>
          <div class="flex items-center gap-2.5 pb-3 mb-3 border-b-2 border-ink">
            <div
              class="w-9 h-9 flex items-center justify-center font-serif font-extrabold text-[15px] flex-shrink-0 bg-[var(--persona-accent,var(--ink))] text-paper"
            >
              {persona.short.charAt(0)}
            </div>
            <div>
              <div class="font-sans text-[8px] tracking-[0.25em] font-bold text-[var(--persona-accent,var(--ink))]">
                {persona.id.toUpperCase()}
              </div>
              <div class="font-serif font-bold text-[16px] leading-none">{persona.name}</div>
            </div>
          </div>
          <p class="font-serif text-[12px] leading-[1.55] mb-3 text-ink">{take.open}</p>
          <div
            class="px-3 py-2 font-serif italic text-[11px] bg-paper-warm border-l-2 border-[var(--persona-accent,var(--ink))] text-ink-soft"
          >
            {take.aside}
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="font-sans text-[8px] tracking-[0.25em] font-bold text-red">PICK</span>
            <span class="font-mono font-extrabold text-[18px] tracking-[-0.03em] text-ink">
              {take.pick}
            </span>
            <span class="font-mono text-[10px] text-ink-dim">· {take.conf}%</span>
          </div>
        </article>
      {/each}
    </div>
    <p class="mt-6 text-center font-serif italic text-[12px] text-ink-dim">
      Six more pundits available. Including Bazzer, who predicted Tottenham 3–0 with 8% confidence.
      He was wrong. He was delighted.
    </p>
  </section>

  <!-- PRICING -->
  <section
    id="pricing"
    class="px-6 md:px-10 py-12 border-b-2 border-ink"
    data-landing-pricing
  >
    <header class="flex items-baseline justify-between mb-8 pb-4 border-b border-ink">
      <h2 class="font-serif font-bold text-[28px] md:text-[38px] tracking-[-0.02em] text-ink">
        Subscription
      </h2>
      <div class="hidden sm:block font-serif italic text-[12px] text-ink-dim">
        One price. No dark patterns. Mickey is already angry enough.
      </div>
    </header>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      {#each plans as plan (plan.name)}
        <article
          class="relative flex flex-col border-2 border-ink"
          class:order-2={plan.variant === 'touchline'}
          class:md:order-1={plan.variant === 'touchline'}
          class:order-1={plan.variant === 'press-box'}
          class:md:order-2={plan.variant === 'press-box'}
          class:order-3={plan.variant === 'print-run'}
          class:md:order-3={plan.variant === 'print-run'}
          class:bg-ink={plan.variant === 'touchline'}
          class:text-paper={plan.variant === 'touchline' || plan.variant === 'press-box'}
          class:bg-red={plan.variant === 'press-box'}
          class:bg-paper-deep={plan.variant === 'print-run'}
          class:text-ink={plan.variant === 'print-run'}
          data-landing-plan
          data-landing-plan-tier={plan.variant}
        >
          {#if plan.badge}
            <div
              class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 font-sans text-[8px] tracking-[0.3em] font-extrabold whitespace-nowrap bg-amber text-paper"
              data-landing-plan-badge
            >
              {plan.badge}
            </div>
          {/if}
          <div class="px-6 pt-6 pb-5 border-b border-rule/40">
            <div
              class="font-sans text-[10px] tracking-[0.3em] font-bold mb-1"
              class:text-red={plan.variant === 'print-run'}
              class:opacity-70={plan.variant !== 'print-run'}
            >
              {plan.name.toUpperCase()}
            </div>
            <div class="flex items-baseline gap-2">
              <div class="font-serif font-bold text-[52px] tracking-[-0.03em] leading-none">
                {plan.price}
              </div>
              {#if plan.price !== 'Free'}
                <div class="text-[12px] opacity-70">/ mo</div>
              {/if}
            </div>
            <div class="font-serif italic text-[11px] mt-1 opacity-70">{plan.sub}</div>
          </div>
          <ul class="flex-1 px-6 py-5 space-y-2">
            {#each plan.features as feature (feature)}
              <li class="flex items-start gap-2.5 font-serif text-[12px]">
                <span class="font-bold mt-0.5">✓</span>
                <span>{feature}</span>
              </li>
            {/each}
          </ul>
          <div class="px-6 pb-6">
            <a
              href={plan.href}
              class="block w-full py-3 text-center font-sans font-extrabold text-[12px] tracking-[0.12em] no-underline"
              class:bg-paper={plan.variant === 'touchline'}
              class:text-ink={plan.variant === 'touchline' || plan.variant === 'print-run'}
              class:bg-ink={plan.variant !== 'touchline'}
              class:text-paper={plan.variant !== 'touchline' && plan.variant !== 'print-run'}
              data-landing-plan-cta
            >
              {plan.cta}
            </a>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <!-- FOOTER -->
  <footer
    class="px-6 md:px-10 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border-t-2 border-ink"
    data-landing-footer
  >
    <div>
      <div class="font-serif font-bold text-[22px] tracking-[-0.02em]">The Kicker.</div>
      <div class="font-serif italic text-[11px] mt-1 text-ink-dim">Your daily football paper.</div>
    </div>
    <div>
      <div class="font-sans text-[9px] tracking-[0.25em] font-bold mb-2 text-red">PRODUCT</div>
      <ul class="space-y-1 font-serif italic text-[12px] text-ink-soft">
        <li>How it works</li>
        <li>The pundits</li>
        <li>Pricing</li>
        <li>The Broadsheet</li>
      </ul>
    </div>
    <div>
      <div class="font-sans text-[9px] tracking-[0.25em] font-bold mb-2 text-red">COMPANY</div>
      <ul class="space-y-1 font-serif italic text-[12px] text-ink-soft">
        <li>About</li>
        <li>Privacy</li>
        <li>Terms</li>
        <li>Contact</li>
      </ul>
    </div>
    <div class="lg:text-right">
      <div class="font-sans text-[9px] tracking-[0.25em] font-bold mb-2 text-ink-dim">
        SMALL PRINT
      </div>
      <p class="font-serif italic text-[10px] leading-[1.5] text-ink-faint">
        All pundits are original characters. Any resemblance to retired centre-backs currently
        employed by major broadcasters is entirely deliberate but legally coincidental.
      </p>
    </div>
  </footer>
</div>
