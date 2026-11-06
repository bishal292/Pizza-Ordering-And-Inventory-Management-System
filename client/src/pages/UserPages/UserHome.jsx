import { useEffect, useState } from "react";
import { apiClient } from "@/utils/api-client";
import { USER_ADD_TO_CART, USER_GET_PIZZAS } from "@/utils/constant";
import { toast } from "sonner";
import useCartStore from "@/Store/cartStore";
import ImageSlider from "@/components/ImageSlider";
import CustomizePizzaModal from "@/components/CustomizePizzaModal"; // Import the CustomizePizzaModal component
import { FaCartPlus } from "react-icons/fa6";
import LoadingScreen from "@/components/LoadingScreen";

const UserHome = () => {
  const [pizzas, setPizzas] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedPizza, setSelectedPizza] = useState(null);
  const addToCart = useCartStore((state) => state.addToCart);

  useEffect(() => {
    const fetchPizzas = async () => {
      setIsLoaded(false);
      try {
        const response = await apiClient.get(USER_GET_PIZZAS, {
          withCredentials: true,
        });
        if (response.status === 200) {
          setPizzas(response.data);
        }
      } catch (error) {
        setLoadError(true);
        toast.error(
          error.response?.data?.message ||
            error.response?.data ||
            "The menu could not be loaded. Please try again."
        );
      } finally {
        setIsLoaded(true);
      }
    };

    fetchPizzas();
  }, []);

  const handleAddToCart = async (pizza) => {
    if (await addToServerCart(pizza)) {
      addToCart(pizza);
      toast.success(`${pizza.name} added to cart`);
    }
  };

  const handleCustomizePizza = (pizza) => {
    setSelectedPizza(pizza);
  };
  const addToServerCart = async (pizza, customizations = {}) => {
    try {
      const item = {
        pizzaId: pizza._id,
        quantity: 1,
        customizations,
        price: pizza.price,
      };
      const response = await apiClient.post(
        USER_ADD_TO_CART,
        { item },
        { withCredentials: true }
      );
      if (response.status === 201) {
        return true;
      }
      return false;
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to add this pizza. Please try again."
      );
      return false;
    }
  };
  const handleSaveCustomizedPizza = async (customizedPizza) => {
    const customizations =
      customizedPizza.customizations === null
        ? {}
        : customizedPizza.customizations;
    const saved = await addToServerCart(selectedPizza, customizations);
    if (!saved) return;
    addToCart(selectedPizza, customizations);
    toast.success(`${selectedPizza.name} added to cart`);
    setSelectedPizza(null);
  };

  if (!isLoaded) {
    return <LoadingScreen message="" />;
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] font-sans">
      <section className="relative isolate overflow-hidden bg-[#241812]">
        <ImageSlider
          images={[
            "https://i0.wp.com/picjumbo.com/wp-content/uploads/detail-of-salami-pizza-free-photo.jpg?w=2210&quality=70",
            "https://media.istockphoto.com/id/864768956/photo/gourmet-homemade-mushroom-pizza.jpg?s=612x612&w=0&k=20&c=0lxTUcy1LXsb1kPRgzv1D32H3kScpH-_oSqsA51xiYM=",
            "https://media.istockphoto.com/id/1280329631/photo/italian-pizza-margherita-with-tomatoes-and-mozzarella-cheese-on-wooden-cutting-board-close-up.jpg?s=612x612&w=0&k=20&c=CFDDjavIC5l8Zska16UZRZDXDwd47fwmRsUNzY0Ym6o=",
          ]}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-r from-[#1b120d]/85 via-[#1b120d]/55 to-[#1b120d]/25 px-5 text-center text-white sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-300 sm:text-sm">
            Fresh from our oven
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
            Welcome to Pizzeria 🍕
          </h1>
          <p className="mb-7 mt-4 max-w-xl text-base text-stone-100 sm:text-xl">
            Your favorite pizzas, made fresh daily!
          </p>
          <a
            href="#orderNow"
            className="rounded-full bg-orange-600 px-7 py-3 text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-700 sm:text-lg"
          >
            Explore the menu
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-7 sm:py-14">
        <div className="mb-8 flex flex-col items-center text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Made for sharing</p>
          <h2
          id="orderNow"
            className="mt-2 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl"
        >
            Find your new favorite
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600 sm:text-base">
            Choose a classic or make it your own with fresh ingredients and
            custom toppings.
          </p>
        </div>

        {loadError ? (
          <div className="rounded-xl border border-stone-200 bg-white px-6 py-12 text-center">
            <p className="font-semibold text-stone-800">We could not reach the menu.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700"
            >
              Try again
            </button>
          </div>
        ) : pizzas.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-6 py-12 text-center text-stone-600">
            No pizzas are available right now. Please check back soon.
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pizzas.map((pizza) => (
            <div
              key={pizza._id}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative overflow-hidden bg-stone-100">
                <img
                  src={`${pizza.image}`}
                  alt={pizza.name}
                  className="h-52 w-full object-cover transition duration-500 group-hover:scale-105"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
                <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-stone-700 shadow-sm">
                  {pizza.size?.name || "House size"}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-stone-900">{pizza.name}</h3>
                  <span className="shrink-0 text-lg font-extrabold text-orange-700">
                    ₹{Number(pizza.price).toFixed(0)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-stone-600">
                  {pizza.description}
                </p>
                <p className="mt-3 truncate text-xs text-stone-500">
                  {[pizza.base?.name, ...(pizza.toppings || []).map((item) => item.name)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                  <button
                    className="flex items-center justify-center gap-2 rounded-lg bg-stone-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
                    onClick={() => handleAddToCart(pizza)}
                  >
                    <FaCartPlus /> Add
                  </button>
                  <button
                    className="rounded-lg border border-orange-200 px-3 py-2.5 text-sm font-semibold text-orange-800 transition hover:bg-orange-50"
                    onClick={() => handleCustomizePizza(pizza)}
                  >
                    Customize
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </section>

      {selectedPizza && (
        <CustomizePizzaModal
          pizza={selectedPizza}
          onSave={handleSaveCustomizedPizza}
          onClose={() => setSelectedPizza(null)}
        />
      )}
    </main>
  );
};

export default UserHome;
