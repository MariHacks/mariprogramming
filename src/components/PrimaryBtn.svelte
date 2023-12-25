<script>
  export let link = '';
</script>

<a href={link} class="btn primary-btn m-0 mx-lg-2 px-lg-2">
  <slot></slot>
</a>

<style>
.primary-btn {
  color: #fff;
  border-color: #fff;
  background-color: #050D2E;
  width: 100%;
}

.primary-btn:hover {
  background-color: #fff;
  color: #050D2E;
}

@media screen and (min-width: 992px) {
  .primary-btn {
    width: auto;
  }
}
</style>