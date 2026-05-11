//+------------------------------------------------------------------+
//| Lennox Gold Bot — HTTP Bridge EA v3                              |
//| Polls VPS bot for orders, sends account balance via PING         |
//+------------------------------------------------------------------+
#property copyright "LennoxOS"
#property version   "3.00"
#property strict

#include <Trade\Trade.mqh>
CTrade m_trade;

input string   BOT_URL      = "http://204.168.142.89:8001";
input int      POLL_SECONDS = 2;
input int      PING_SECONDS = 30;
input ulong    MAGIC        = 260501;
input string   COMMENT_PFX  = "Lennox";

datetime g_last_poll = 0;
datetime g_last_ping = 0;
bool     g_inited    = false;

//+------------------------------------------------------------------+
int OnInit()
{
   m_trade.SetExpertMagicNumber(MAGIC);
   m_trade.SetDeviationInPoints(20);
   m_trade.SetTypeFilling(ORDER_FILLING_IOC);
   m_trade.SetAsyncMode(false);

   // Allow this URL in MT5: Tools → Options → Expert Advisors → Allow WebRequest
   // Add: http://204.168.142.89:8001
   Print("Lennox HTTP Bridge v3 started — ", BOT_URL);
   Print("Magic: ", MAGIC, " | Symbol: ", Symbol());

   g_inited = true;
   SendPing();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   // Notify bot we're going offline
   string body = "{\"action\":\"PING\",\"status\":\"MT5_OFFLINE\",\"balance\":0,\"equity\":0,\"positions\":0}";
   SendPost("/result", body);
   Print("Lennox HTTP Bridge stopped");
}

//+------------------------------------------------------------------+
void OnTick()
{
   if(!g_inited) return;
   datetime now = TimeCurrent();

   if(now - g_last_ping >= PING_SECONDS) {
      g_last_ping = now;
      SendPing();
   }

   if(now - g_last_poll >= POLL_SECONDS) {
      g_last_poll = now;
      PollOrders();
   }
}

//+------------------------------------------------------------------+
void SendPing()
{
   double bal      = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq       = AccountInfoDouble(ACCOUNT_EQUITY);
   int    pos      = PositionsTotal();
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   long   login    = AccountInfoInteger(ACCOUNT_LOGIN);
   string broker   = AccountInfoString(ACCOUNT_SERVER);

   string body = StringFormat(
      "{\"action\":\"PING\",\"status\":\"MT5_ONLINE\","
      "\"balance\":%.2f,\"equity\":%.2f,\"positions\":%d,"
      "\"currency\":\"%s\",\"login\":%d,\"broker\":\"%s\"}",
      bal, eq, pos, currency, login, broker
   );
   SendPost("/result", body);
   Print("PING sent — balance=", bal, " equity=", eq, " positions=", pos);
}

//+------------------------------------------------------------------+
void PollOrders()
{
   char   req_data[];
   char   result[];
   string result_headers;
   string url = BOT_URL + "/pending";

   int code = WebRequest("GET", url, "", 3000, req_data, result, result_headers);
   if(code < 0) {
      static int err_count = 0;
      if(++err_count % 30 == 1) Print("WARN: /pending unreachable code=", code);
      return;
   }

   string resp = CharArrayToString(result);
   if(StringFind(resp, "orders") < 0) return;

   // --- parse orders array ---
   int pos = StringFind(resp, "\"orders\":[");
   if(pos < 0) return;
   pos += 10;

   int depth = 0;
   int obj_start = -1;

   for(int i = pos; i < StringLen(resp); i++) {
      ushort c = StringGetCharacter(resp, i);
      if(c == '{') {
         if(depth == 0) obj_start = i;
         depth++;
      } else if(c == '}') {
         depth--;
         if(depth == 0 && obj_start >= 0) {
            string order_json = StringSubstr(resp, obj_start, i - obj_start + 1);
            ProcessOrder(order_json);
            obj_start = -1;
         }
      }
   }
}

//+------------------------------------------------------------------+
string GetField(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start < 0) return "";
   start += StringLen(search);

   bool is_string = (StringGetCharacter(json, start) == '"');
   if(is_string) {
      start++;
      int end = StringFind(json, "\"", start);
      if(end < 0) return "";
      return StringSubstr(json, start, end - start);
   } else {
      int end = start;
      while(end < StringLen(json)) {
         ushort c = StringGetCharacter(json, end);
         if(c == ',' || c == '}' || c == ']') break;
         end++;
      }
      return StringSubstr(json, start, end - start);
   }
}

//+------------------------------------------------------------------+
void ProcessOrder(string json)
{
   string id      = GetField(json, "id");
   string type    = GetField(json, "type");
   string symbol  = GetField(json, "symbol");
   double price   = StringToDouble(GetField(json, "price"));
   double sl      = StringToDouble(GetField(json, "sl"));
   double tp      = StringToDouble(GetField(json, "tp"));
   double lots    = StringToDouble(GetField(json, "lots"));
   string comment = GetField(json, "comment");

   if(StringLen(id) == 0 || StringLen(type) == 0) return;
   if(StringLen(symbol) == 0) symbol = "XAUUSD";

   Print("Processing order: ", id, " type=", type, " price=", price, " sl=", sl, " tp=", tp, " lots=", lots);

   // CLOSE order
   if(type == "CLOSE") {
      ulong ticket = (ulong)StringToInteger(GetField(json, "ticket"));
      if(ticket > 0) {
         bool ok = m_trade.PositionCloseByTicket(ticket);
         string status = ok ? "CLOSED" : "CLOSE_FAILED";
         PostResult(id, status, 0, m_trade.ResultRetcode());
      } else {
         // Close all positions for symbol
         for(int i = PositionsTotal() - 1; i >= 0; i--) {
            ulong pos_ticket = PositionGetTicket(i);
            if(PositionGetString(POSITION_SYMBOL) == symbol) {
               m_trade.PositionClose(pos_ticket);
            }
         }
         PostResult(id, "CLOSED_ALL", 0, 0);
      }
      return;
   }

   // LIMIT orders
   ENUM_ORDER_TYPE order_type;
   if(type == "BUY_LIMIT")        order_type = ORDER_TYPE_BUY_LIMIT;
   else if(type == "SELL_LIMIT")  order_type = ORDER_TYPE_SELL_LIMIT;
   else if(type == "BUY")         order_type = ORDER_TYPE_BUY;
   else if(type == "SELL")        order_type = ORDER_TYPE_SELL;
   else {
      Print("Unknown order type: ", type);
      PostResult(id, "REJECTED_UNKNOWN_TYPE", 0, 0);
      return;
   }

   m_trade.SetExpertMagicNumber(MAGIC);
   string full_comment = COMMENT_PFX + "_" + (StringLen(comment) > 0 ? comment : id);

   bool ok = false;
   if(order_type == ORDER_TYPE_BUY || order_type == ORDER_TYPE_SELL) {
      if(order_type == ORDER_TYPE_BUY)
         ok = m_trade.Buy(lots, symbol, 0, sl, tp, full_comment);
      else
         ok = m_trade.Sell(lots, symbol, 0, sl, tp, full_comment);
   } else {
      ok = m_trade.OrderOpen(symbol, order_type, lots, 0, price, sl, tp,
                             ORDER_TIME_GTC, 0, full_comment);
   }

   ulong ticket = ok ? m_trade.ResultOrder() : 0;
   uint  retcode = m_trade.ResultRetcode();
   string status = ok ? "FILLED" : "REJECTED";

   Print("Order result: ", id, " -> ", status, " ticket=", ticket, " retcode=", retcode);
   PostResult(id, status, ticket, retcode);
}

//+------------------------------------------------------------------+
void PostResult(string id, string status, ulong ticket, uint retcode)
{
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   int    pos = PositionsTotal();

   string body = StringFormat(
      "{\"id\":\"%s\",\"status\":\"%s\",\"ticket\":%d,\"retcode\":%d,"
      "\"balance\":%.2f,\"equity\":%.2f,\"positions\":%d}",
      id, status, ticket, retcode, bal, eq, pos
   );
   SendPost("/result", body);

   // Update balance on every result
   g_last_ping = TimeCurrent();
}

//+------------------------------------------------------------------+
void SendPost(string endpoint, string body)
{
   char   data[];
   char   result[];
   string result_headers;
   string url = BOT_URL + endpoint;

   int len = StringToCharArray(body, data, 0, StringLen(body), CP_UTF8) - 1;
   if(len <= 0) return;
   ArrayResize(data, len);

   int code = WebRequest("POST", url, "Content-Type: application/json\r\n", 5000, data, result, result_headers);
   if(code < 0 && code != 200) {
      static int post_err = 0;
      if(++post_err % 10 == 1) Print("WARN: POST ", endpoint, " code=", code);
   }
}
