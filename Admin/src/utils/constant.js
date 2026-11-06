export const HOST = import.meta.env.VITE_HOST
const baseRoute = `${HOST}/api/v1`

export const GET_LOGGED_USER_INFO = `${baseRoute}/auth/get-user-info`

// ADMIN ROUTES
// ADMIN AUTH - ROUTES
const AdminAuth = `${baseRoute}/admin/auth`
export const ADMIN_AUTH_LOGIN = `${AdminAuth}/login`
export const ADMIN_AUTH_SIGNUP = `${AdminAuth}/signup`
export const ADMIN_AUTH_LOGOUT = `${AdminAuth}/logout`
export const ADMIN_AUTH_FORGOT_PASS = `${AdminAuth}/forgotpassword`
export const ADMIN_AUTH_RESET_PASS = `${AdminAuth}/resetpassword`
export const ADMIN_AUTH_CHANGE_PASS = `${AdminAuth}/changepassword`
export const ADMIN_AUTH_UPDATE_PROFILE = `${AdminAuth}/profile`

// ADMIN OTHER ROUTES
export const ADMIN_DASHBOARD = `${baseRoute}/admin/dashboard`
export const ADMIN_DASHBOARD_REVENUE = `${ADMIN_DASHBOARD}/revenue`
export const ADMIN_DASHBOARD_ORDER = `${ADMIN_DASHBOARD}/order`

// Admin - Inventory Routes
export const ADMIN_INVENTORY = `${baseRoute}/admin/inventory`
export const ADMIN_ADD_PRODUCT = `${baseRoute}/admin/addproduct`
export const ADMIN_UPDATE_PRODUCT = `${baseRoute}/admin/updateproduct`  // PATCH -> PRODUCT ID
export const ADMIN_DELETE_PRODUCT = `${baseRoute}/admin/deleteproduct`  // DELETE -> PRODUCT ID

// Admin - User Routes
export const ADMIN_GET_ALL_USERS = `${baseRoute}/admin/users-list`
export const ADMIN_SEARCH_USER = `${baseRoute}/admin/user/search`
export const ADMIN_UPDATE_USER = `${baseRoute}/admin/update-user`  // PATCH -> USER ID
export const ADMIN_DELETE_USER = `${baseRoute}/admin/delete-user`  // DELETE -> USER ID
export const ADMIN_USER_CART = `${baseRoute}/admin/user/cart`  // DELETE -> USER ID
export const ADMIN_USER_ORDER_DETAILS = `${baseRoute}/admin/user-order-details`  // DELETE -> USER ID

// Admin - Pizza Routes
export const ADMIN_GET_PIZZAS = `${baseRoute}/admin/get-pizzas`
export const ADMIN_UPLOAD_PIZZA_IMAGE = `${baseRoute}/admin/pizza/upload`
export const ADMIN_ADD_PIZZA = `${baseRoute}/admin/addpizza`
export const ADMIN_UPDATE_PIZZA = `${baseRoute}/admin/updatepizza`  // PATCH -> PIZZA ID
export const ADMIN_DELETE_PIZZA = `${baseRoute}/admin/deletepizza`  // DELETE -> PIZZA ID
export const ADMIN_GET_PIZZA_DETAILS = `${baseRoute}/admin/pizza/get-pizza-details`  // GET -> PIZZA ID

// Admin - Order Routes
export const ADMIN_UPDATE_ORDER_STATUS = `${baseRoute}/admin/order`  // PATCH -> id : query -> status : body -> Update status
export const ADMIN_ALL_ORDERS = `${baseRoute}/admin/orders` // GET -> ALL ORDERS
export const ADMIN_USER_ORDERS = `${baseRoute}/admin/user/orders` // GET -> id : userId-query -> particular USER's ALL ORDERS
export const ADMIN_ORDER_DETAILS = `${baseRoute}/admin/order/detail` // GET -> id : query -> particular ORDER's DETAILS
export const ADMIN_ORDER_FILTERED = `${baseRoute}/admin/orders/filtered` // GET -> status : query  -> orders according to given valid status like "completed" or "pending"