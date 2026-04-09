package com.trivia.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import reactor.util.context.Context;

import java.util.UUID;

@Component
@Order(-1)
public class TransactionIdWebFilter implements WebFilter {

    private static final Logger log = LoggerFactory.getLogger(TransactionIdWebFilter.class);

    public static final String TRANSACTION_ID_KEY = "transactionId";
    public static final String TRANSACTION_ID_HEADER = "X-Transaction-Id";

    @Override
    @NonNull
    public Mono<Void> filter(@NonNull ServerWebExchange exchange, @NonNull WebFilterChain chain) {
        String transactionId = UUID.randomUUID().toString();

        exchange.getResponse().getHeaders().add(TRANSACTION_ID_HEADER, transactionId);

        return chain.filter(exchange)
                .contextWrite(Context.of(TRANSACTION_ID_KEY, transactionId))
                .doFirst(() -> {
                    MDC.put(TRANSACTION_ID_KEY, transactionId);
                    log.info("Request:: {} {}", exchange.getRequest().getMethod(), exchange.getRequest().getPath());
                    MDC.remove(TRANSACTION_ID_KEY);
                })
                .doFinally(signal -> {
                    MDC.put(TRANSACTION_ID_KEY, transactionId);
                    log.info("Response:: {} {} status={}", exchange.getRequest().getMethod(),
                            exchange.getRequest().getPath(),
                            exchange.getResponse().getStatusCode());
                    MDC.remove(TRANSACTION_ID_KEY);
                });
    }
}