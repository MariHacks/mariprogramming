<script>
  export let link = '';
</script>

<a href={link} class="btn secondary-btn m-0 mx-lg-2 px-lg-2">
  <slot></slot>
</a>

<style>
.secondary-btn {
  color: #050D2E;
  border-color: #050D2E;
  background-color: #fff;
}

.secondary-btn:hover {
  background-color: #050D2E;
  color: #fff;
}
</style>