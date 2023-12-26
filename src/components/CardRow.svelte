<script>
  export let bg, topSpacing;
</script>

<div class={"d-grid justify-content-center align-items-center card-row w-100" + (bg ? ` ${bg}` : '') + (topSpacing ? " reg-container" : " px-5 pb-5")}>
  <slot></slot>
</div>

<style>
.card-row {
  row-gap: 2.5em;
  grid-auto-rows: 1fr; /* rows of the same height */
  grid-auto-columns: 1fr;
  justify-self: center;
}

.card-row.light-blue {
  background-color: #99C2FF;
}

.card-row.light-gray {
  background-color: #ddd;
}

@media screen and (min-width: 768px) {
  .card-row {
    grid-template-columns: repeat(2, 1fr);
    column-gap: 2em;
  }
}

@media screen and (min-width: 1200px) {
  .card-row {
    grid-template-columns: repeat(3, 1fr);
    column-gap: 3em;
  }
}
</style>