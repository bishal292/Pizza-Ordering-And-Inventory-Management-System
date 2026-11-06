import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaTrash } from "react-icons/fa";
import { toast } from "sonner";
import LoadingScreen from "@/components/LoadingScreen";
import { apiClient } from "@/utils/api-client";
import { ADMIN_DELETE_PIZZA, ADMIN_GET_PIZZA_DETAILS } from "@/utils/constant";

const renderIngredientGroup = (label, items) => (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
        {label}
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {(items || []).length ? (
          items.map((item, index) => (
            <span
              key={`${item?._id || item?.name || label}-${index}`}
              className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700"
            >
              {item?.name || "Unavailable item"}
            </span>
          ))
        ) : (
          <span className="text-sm text-stone-400">None</span>
        )}
      </div>
    </div>
  );

const PizzaDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pizza, setPizza] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchPizzaDetails = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get(
          `${ADMIN_GET_PIZZA_DETAILS}?id=${encodeURIComponent(id)}`
        );
        if (active) setPizza(response.data);
      } catch (error) {
        if (active) {
          setPizza(null);
          toast.error(
            error.response?.data?.message ||
              error.response?.data ||
              "Unable to load pizza details."
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchPizzaDetails();
    return () => {
      active = false;
    };
  }, [id]);

  const deletePizza = async () => {
    setIsDeleting(true);
    try {
      await apiClient.delete(
        `${ADMIN_DELETE_PIZZA}?id=${encodeURIComponent(id)}`
      );
      toast.success("Pizza deleted");
      navigate("/admin/pizzas", { replace: true });
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to delete this pizza."
      );
    } finally {
      setIsDeleting(false);
      setIsDeletePopupOpen(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading pizza details..." />;

  if (!pizza) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="rounded-xl border border-stone-200 bg-white p-6 text-center text-stone-600">
          Pizza details could not be loaded.
        </p>
        <Link
          to="/admin/pizzas"
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-orange-700"
        >
          <FaArrowLeft /> Back to pizzas
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#faf8f5] px-4 py-6 sm:px-7 sm:py-9">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/admin/pizzas"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-orange-700"
        >
          <FaArrowLeft /> All pizzas
        </Link>
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="relative min-h-64 bg-stone-100 md:min-h-[480px]">
              <img
                src={pizza.image}
                alt={pizza.name}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />
              <span
                className={`absolute left-5 top-5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  pizza.status === "available"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {pizza.status || "status unknown"}
              </span>
            </div>
            <div className="flex flex-col p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-700">
                Menu item
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
                {pizza.name}
              </h1>
              <p className="mt-4 leading-7 text-stone-600">
                {pizza.description}
              </p>
              <div className="mt-6 flex items-end justify-between border-b border-stone-200 pb-5">
                <div>
                  <p className="text-sm text-stone-500">Menu price</p>
                  <p className="mt-1 text-3xl font-bold text-stone-900">
                    ₹{Number(pizza.price).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-stone-500">Size</p>
                  <p className="font-semibold text-stone-800">
                    {pizza.size?.name || "Not set"}
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-5">
                {renderIngredientGroup("Base", pizza.base ? [pizza.base] : [])}
                {renderIngredientGroup("Sauce", pizza.sauce)}
                {renderIngredientGroup("Cheese", pizza.cheese)}
                {renderIngredientGroup("Toppings", pizza.toppings)}
              </div>
              <div className="mt-auto pt-8">
                {pizza.hasOrderHistory && (
                  <p className="mb-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This pizza appears in order history and cannot be deleted.
                  </p>
                )}
                <button
                  type="button"
                  disabled={pizza.hasOrderHistory}
                  onClick={() => setIsDeletePopupOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-3 font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400 disabled:hover:bg-white"
                >
                  <FaTrash /> Delete pizza
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isDeletePopupOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) {
              setIsDeletePopupOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-pizza-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="delete-pizza-title" className="text-xl font-bold text-stone-900">
              Delete {pizza.name}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              This action cannot be undone. Pizzas referenced by order history
              are protected.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeletePopupOpen(false)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Keep pizza
              </button>
              <button
                type="button"
                disabled={isDeleting || pizza.hasOrderHistory}
                onClick={deletePizza}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default PizzaDetails;
