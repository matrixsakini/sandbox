package com.trivia.config;

import com.trivia.filter.TransactionIdWebFilter;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.reactivestreams.Subscription;
import org.slf4j.MDC;
import org.springframework.context.annotation.Configuration;
import reactor.core.CoreSubscriber;
import reactor.core.publisher.Hooks;
import reactor.core.publisher.Operators;
import reactor.util.context.Context;

/**
 * Bridges Reactor Context → SLF4J MDC so that every log statement inside a reactive
 * pipeline automatically includes the transactionId without any per-call wiring.
 */
@Configuration
public class MdcContextPropagator {

    private static final String HOOK_KEY = "mdcTransactionIdPropagator";

    @PostConstruct
    public void registerHook() {
        Hooks.onEachOperator(HOOK_KEY,
                Operators.lift((scannable, subscriber) -> new MdcContextLifter<>(subscriber)));
    }

    @PreDestroy
    public void removeHook() {
        Hooks.resetOnEachOperator(HOOK_KEY);
    }

    static class MdcContextLifter<T> implements CoreSubscriber<T> {

        private final CoreSubscriber<T> delegate;

        MdcContextLifter(CoreSubscriber<T> delegate) {
            this.delegate = delegate;
        }

        @Override
        public Context currentContext() {
            return delegate.currentContext();
        }

        @Override
        public void onSubscribe(Subscription s) {
            delegate.onSubscribe(s);
            propagateToMdc();
        }

        @Override
        public void onNext(T t) {
            propagateToMdc();
            delegate.onNext(t);
        }

        @Override
        public void onError(Throwable t) {
            propagateToMdc();
            delegate.onError(t);
        }

        @Override
        public void onComplete() {
            propagateToMdc();
            delegate.onComplete();
        }

        private void propagateToMdc() {
            Context ctx = currentContext();
            propagateKey(ctx, TransactionIdWebFilter.TRANSACTION_ID_KEY);
            propagateKey(ctx, "sessionId");
        }

        private void propagateKey(Context ctx, String key) {
            if (ctx.hasKey(key)) {
                MDC.put(key, ctx.get(key));
            } else {
                MDC.remove(key);
            }
        }
    }
}