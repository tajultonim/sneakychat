<script lang="ts">
  export let count: number = 14;

  interface Firefly {
    id: number;
    left: number;
    top: number;
    tx: number;
    ty: number;
    duration: number;
    delay: number;
  }

  const fireflies: Firefly[] = Array.from({ length: count }, (_, i) => ({
    id:       i,
    left:     Math.random() * 100,
    top:      Math.random() * 100,
    tx:       (Math.random() - 0.5) * 200,
    ty:       (Math.random() - 0.5) * 200,
    duration: 4 + Math.random() * 8,
    delay:    Math.random() * 8,
  }));
</script>

{#each fireflies as ff (ff.id)}
  <div
    class="firefly fixed w-1 h-1 bg-[#FFE566] rounded-full pointer-events-none z-[1] opacity-0 animate-float"
    style="
      left:{ff.left}vw;
      top:{ff.top}vh;
      --tw-tx:{ff.tx}px;
      --tw-ty:{ff.ty}px;
      animation-duration:{ff.duration}s;
      animation-delay:{ff.delay}s;
      box-shadow:0 0 6px 2px #FFE566;
    "
  ></div>
{/each}
