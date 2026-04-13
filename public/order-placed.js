(function () {
    function goToStores() {
        window.location.href = "stores.html";
    }

    function goToOrders() {
        window.location.href = "customer-orders.html";
    }

    window.addEventListener("DOMContentLoaded", function () {
        const btn = document.getElementById("orderAgainBtn");
        const ordersBtn = document.getElementById("viewOrdersBtn");

        if (btn) btn.addEventListener("click", goToStores);
        if (ordersBtn) ordersBtn.addEventListener("click", goToOrders);
    });
})();
