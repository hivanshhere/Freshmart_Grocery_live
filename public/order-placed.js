(function () {
    function goToStores() {
        window.location.href = "stores.html";
    }

    window.addEventListener("DOMContentLoaded", function () {
        const btn = document.getElementById("orderAgainBtn");
        if (!btn) return;

        btn.addEventListener("click", goToStores);
    });
})();
